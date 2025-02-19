import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonButton, IonList, IonInput, IonItem,
  IonButtons, IonMenuButton, IonText, useIonAlert, isPlatform, IonIcon, useIonLoading, AlertOptions } from '@ionic/react';
import { useState, useEffect, useContext } from 'react';
import { eye, eyeOff } from 'ionicons/icons';
import { CapacitorHttp, HttpOptions, HttpResponse } from '@capacitor/core';
import { usePouch} from 'use-pouchdb';
import { ConnectionStatus, DBCreds, DBUUIDAction } from '../components/RemoteDBState';
import { Preferences } from '@capacitor/preferences';
import { App } from '@capacitor/app';
import { createNewUser, getTokenInfo, navigateToFirstListID, errorCheckCreds  } from '../components/RemoteUtilities';
import { cloneDeep } from 'lodash';
import { RemoteDBStateContext, SyncStatus, initialRemoteDBState } from '../components/RemoteDBState';
import { HistoryProps } from '../components/DataTypes';
import { useLists } from '../components/Usehooks';
import { apiConnectTimeout } from '../components/Utilities';
import { useTranslation } from 'react-i18next';

export type RemoteState = {
  password: string | undefined,
  verifyPassword: string | undefined,
  httpResponse: HttpResponse | undefined,
  inCreateMode: boolean,
  loginByPassword: boolean,
  formError: string,
  showMainPassword: boolean,
  showVerifyPassword: boolean
}

export const initRemoteState = {
  password: "",
  verifyPassword: "",
  httpResponse: undefined,
  inCreateMode: false,
  loginByPassword: false,
  formError: "",
  showMainPassword: false,
  showVerifyPassword: false
}

/* 
Three logic paths: 

1) Come in with remoteDBState.dbuuidaction not = none
    Exit app if set to exit.
    Prompt and destroy if set to destroy

2) No or invalid creds
    Show login form
    validate creds syntax
    if syntax error, show again
    http call to api:/issuetoken
    if successful, store creds, otherwise back to form
    one async call: (assignDBAndSync)
    failure means credsError and DBUUIDAction set
       
3) Create User
    show new user form
    validate creds syntax
    if syntax error, show again
    http call to api:/createnewuser
    if successful, store creds, otherwise back to form
    assign db, proceed to sync

states to support:
  (all useeffects do nothing on credserror)

  init (do nothing other than display form)
        API call will be made with await (either create new user or issue token)
          and if errors, will not proceed beyond init 
          if successful, populate and store creds and then await assigndb / sync
 */

const RemoteDBLogin: React.FC<HistoryProps> = (props: HistoryProps) => {
    const db=usePouch();
    const [remoteState,setRemoteState]=useState<RemoteState>(initRemoteState);
    const [presentAlert] = useIonAlert();
    const { remoteDBState, remoteDBCreds, setRemoteDBState, setRemoteDBCreds, assignDB, setDBCredsValue} = useContext(RemoteDBStateContext);
    const { listRowsLoaded, listRows } = useLists();
    const [ present, dismiss ]= useIonLoading();
    const { t } = useTranslation();

    // useEffect for initial page launch
    useEffect( () => {
      if (remoteDBState.credsError) {
        setRemoteState(prevState => ({...prevState,formError: remoteDBState.credsErrorText}))
      }
    },[])

    // effect for dbuuidaction not none
    useEffect( () => {
      async function presentAndExit(alertObject: AlertOptions) {
        await presentAlert(alertObject);
        setRemoteDBState(({...remoteDBState,dbUUIDAction: DBUUIDAction.none}))
      };
      if (remoteDBState.dbUUIDAction !== DBUUIDAction.none) {
        if (remoteDBState.dbUUIDAction === DBUUIDAction.exit_app_schema_mismatch) {
          console.log("ERROR: Schema too new, not supported with this app version. Upgrade.");
          presentAndExit({
            header: t("error.error") as string,
            message: t("error.app_not_support_newer_schema") as string,
            buttons: [{text:t("general.ok"),handler: () => exitApp()}]
          });
          return;
        }
        if (remoteDBState.dbUUIDAction === DBUUIDAction.exit_local_remote_schema_mismatch) {
          console.log("ERROR: Local/Remote schema mismatch. Must destroy local Databse.");
          presentAlert( {
            header: t("error.warning"),
            message: t("error.different_database_schema"),
            buttons: [
              {text: t("general.delete_exit"),handler: () => destroyAndExit()},
              {text: t("general.cancel_exit"),handler: () => exitApp()}
              ]
          })
          return;
        }
        if (remoteDBState.dbUUIDAction === DBUUIDAction.exit_no_uuid_on_server) {
          console.log("ERROR: No database UUID defined in server todos database. Cannot continue");
          presentAndExit({
            header: t("error.error") as string,
            message: t("error.server_no_unique_id") as string,
            buttons: [t("general.ok") as string]
          });
          return;
        } else if (remoteDBState.dbUUIDAction === DBUUIDAction.destroy_needed) {
          presentAlert( {
            header: t("error.warning"),
            message: t("error.different_database_unique_id"),
            buttons: [
              {text: t("general.delete_exit"),handler: () => destroyAndExit()},
              {text: t("general.cancel_exit"),handler: () => exitApp()}
              ]
          })
        }
      }
    },[remoteDBState.dbUUIDAction])

    useEffect( () => {
      if (listRowsLoaded) {
        if (remoteDBState.connectionStatus === ConnectionStatus.cannotStart) {
          console.log("Detected cannot start, setting initRemoteState");
          setRemoteState(initRemoteState);
        } else if (remoteDBState.connectionStatus === ConnectionStatus.loginComplete) {
          navigateToFirstListID(props.history,remoteDBCreds, listRows);
        }
      }
    },[remoteDBState.connectionStatus, db, listRows, props.history, remoteDBCreds, listRowsLoaded]);

    async function destroyAndExit() {
      await db.destroy();
      await Preferences.remove({key: 'dbcreds'});
      exitApp();
    }

    async function exitApp() {
      if (!(isPlatform("desktop") || isPlatform("electron"))) {App.exitApp()}
      console.log("RESETTING TO INITSTATE");
      setRemoteDBState(initialRemoteDBState);
      window.location.replace('about:blank');
//      window.location.replace('/');
  
    }

    function updateDBCredsFromResponse(response: HttpResponse): DBCreds {
      let newDBCreds=cloneDeep(remoteDBCreds);
      newDBCreds.couchBaseURL  = response?.data.couchdbUrl;
      newDBCreds.database = response?.data.couchdbDatabase;
      newDBCreds.email = response?.data.email;
      newDBCreds.fullName = response?.data.fullname;
      newDBCreds.refreshJWT = response?.data.refreshJWT;
      return newDBCreds;
    }
    
  async function showLoading() {
    await present( {
      message: t("general.loading")
    })
  }

  async function submitForm() {
    await showLoading();
    setRemoteState(prevState => ({...prevState,formError: ""}));
    let credsCheck = errorCheckCreds({credsObj: remoteDBCreds,background:false,creatingNewUser:false,password: remoteState.password});
    if (credsCheck.credsError ) {
      setRemoteState(prevState => ({...prevState,formError: String(credsCheck.errorText)}))
      await dismiss();
      return;
    }
    console.log("creds check ok... trying to issue token...");
    let response: HttpResponse;
    const options : HttpOptions = {
        url: String(remoteDBCreds.apiServerURL+"/issuetoken"),
        method: "POST",
        headers: { 'Content-Type': 'application/json; charset=UTF-8',
                   'Accept': 'application/json'},
        connectTimeout: apiConnectTimeout,              
        data: { username: remoteDBCreds.dbUsername,
                password: remoteState.password,
                deviceUUID: remoteDBState.deviceUUID},  
      
    };
    try {response = await CapacitorHttp.post(options)}
    catch(err) {console.log("Error logging in...",err)
                setRemoteState(prevState => ({...prevState, formError: t("error.could_not_contact_api_server")}));
                setRemoteDBState({...remoteDBState, serverAvailable: false});
                await dismiss();
                return}
    console.log("did API /issuetoken : result: ", cloneDeep(response));            
    if (!((response?.status === 200) && (response?.data?.loginSuccessful))) {
        setRemoteState(prevState => ({...prevState, formError: t("error.invalid_authentication")}))
        await dismiss();
        return
    }
    let newCreds=updateDBCredsFromResponse(response);
    let tokenInfo = getTokenInfo(response.data.accessJWT);
    setRemoteDBCreds(newCreds);
    setRemoteDBState({...remoteDBState, accessJWT: response.data.accessJWT, accessJWTExpirationTime: tokenInfo.expireDate});
    await assignDB(response.data.accessJWT);
    await dismiss();
  }
  
  async function submitCreateForm() {
    await showLoading();
    let createResponse: HttpResponse | undefined;
    let credsCheck = errorCheckCreds({credsObj: remoteDBCreds,background: false,creatingNewUser: true,password: remoteState.password,verifyPassword: remoteState.verifyPassword});
    if (!credsCheck.credsError) {
      createResponse = await createNewUser(remoteDBState,remoteDBCreds,String(remoteState.password));
      if (createResponse === undefined) { 
        setRemoteState(prevState => ({...prevState, formError: t("error.creating_user")}));
        await dismiss();
        return;
      }
      if (!createResponse.data.createdSuccessfully) {
        credsCheck.errorText="";
        if (createResponse.data.invalidData) {credsCheck.errorText = t("error.invalid_data_entered");} 
        else if (createResponse.data.userAlreadyExists) {credsCheck.errorText = t("error.user_already_exists");}
        setRemoteState(prevState => ({...prevState, formError: credsCheck.errorText}))
        await dismiss();
        return;
      }
    } else {
      setRemoteState(prevState => ({...prevState, formError: String(credsCheck.errorText)}));
      await dismiss();
      return;
    }
    let newCreds=updateDBCredsFromResponse(createResponse);
    setRemoteDBCreds(newCreds);
    let tokenInfo = getTokenInfo(createResponse.data.accessJWT);
    setRemoteDBState({...remoteDBState,accessJWT: createResponse.data.accessJWT, accessJWTExpirationTime: tokenInfo.expireDate});
    await assignDB(createResponse.data.accessJWT);
    await dismiss();
  }
  
  async function callResetPasswordAPI() {
    const options: HttpOptions = {
        url: String(remoteDBCreds.apiServerURL+"/resetpassword"),
        method: "POST",
        headers: { 'Content-Type': 'application/json',
                   'Accept': 'application/json'},
        data: { username: remoteDBCreds.dbUsername },   
        connectTimeout: apiConnectTimeout        
    };
    try {await CapacitorHttp.post(options);}
    catch(err) {console.log("ERROR: resetting password",err)}
//    presentAlert({
//      header: "Password Request Sent",
//      message: "Please check your email for the link to reset your password",
//      buttons: ["OK"]
//    })

  }

  function resetPassword() {
    if (remoteDBCreds.dbUsername === "" || remoteDBCreds.dbUsername === null || remoteDBCreds.dbUsername === undefined) {
      setRemoteState(prevState => ({...prevState, formError: t("error.must_enter_username_reset_password")}))
    } else {
      presentAlert({
        header: t("general.request_password_reset"),
        message: t("general.press_reset_receive_email"),
        buttons: [ {
          text: t("general.cancel"), role: "cancel"
        }, {
          text: t("general.reset"), role: "confirm", handler: () => callResetPasswordAPI()
        }]
      })
    }
  }

  function setWorkingOffline() {
    setRemoteDBState({...remoteDBState,workingOffline: true,connectionStatus: ConnectionStatus.loginComplete, 
        syncStatus: SyncStatus.offline})
    navigateToFirstListID(props.history,remoteDBCreds, listRows);    
  }

/*   function workOffline() {
    presentAlert({
      header: "Choose to work offline",
      message: "You can choose to work offline with your locally replicated data. Please be aware that your changes will not be synchronized back to the server until you restart the app and login again. The chance for conflicts also increases.",
      buttons: [ {
        text: "Cancel", role: "cancel" },
        { text: "Work Offline", role: "confirm", handler: () => setWorkingOffline()}
      ]})      
  }
 */

//  if (remoteDBState.syncStatus === SyncStatus.active || remoteDBState.syncStatus === SyncStatus.paused) {
//    return (<></>)
//  }
  
  let formElem;
  if (remoteDBState.serverAvailable) {
    if (!remoteState.inCreateMode) {
      formElem = <><IonItem>
      <IonInput label={t("general.api_server_url") as string} labelPlacement="stacked" type="url" inputmode="url" value={remoteDBCreds.apiServerURL} onIonInput={(e) => {setDBCredsValue("apiServerURL",String(e.detail.value))}}>
      </IonInput>
      </IonItem>
      <IonItem>
      <IonInput label={t("general.username") as string} labelPlacement="stacked"  type="text" autocomplete="username" value={remoteDBCreds.dbUsername} onIonInput={(e) => {setDBCredsValue("dbUsername",String(e.detail.value))}}>
      </IonInput>
      </IonItem>
      <IonItem>
      <IonInput label={t("general.password") as string} labelPlacement="stacked" autocomplete="current-password" type={remoteState.showMainPassword ? "text" : "password"} value={remoteState.password} onIonInput={(e) => {setRemoteState(prevstate => ({...prevstate, password: String(e.detail.value)}))}}>
      </IonInput><IonIcon slot="end"  icon={remoteState.showMainPassword ? eyeOff : eye} onClick={() => {setRemoteState((prevState) => ({...prevState,showMainPassword: !prevState.showMainPassword}))}}></IonIcon>
      </IonItem>
      </>
    } else {
      formElem = <>
      <IonItem>
      <IonInput label={t("general.api_server_url") as string} labelPlacement="stacked" type="url" inputmode="url" value={remoteDBCreds.apiServerURL} onIonInput={(e) => {setDBCredsValue("apiServerURL:",String(e.detail.value))}}>
      </IonInput>
      </IonItem>
      <IonItem>
      <IonInput label={t("general.username") as string} labelPlacement="stacked" type="text" autocomplete="username" value={remoteDBCreds.dbUsername} onIonInput={(e) => {setDBCredsValue("dbUsername",String(e.detail.value))}}>
      </IonInput>
      </IonItem>
      <IonItem>
      <IonInput label={t("general.email_address") as string} labelPlacement="stacked" type="email" autocomplete="email" value={remoteDBCreds.email} onIonInput={(e) => {setDBCredsValue("email",String(e.detail.value))}}>
      </IonInput>
      </IonItem>
      <IonItem>
      <IonInput label={t("general.fullname") as string} labelPlacement="stacked"  type="text" value={remoteDBCreds.fullName} onIonInput={(e) => {setDBCredsValue("fullName",String(e.detail.value))}}>
      </IonInput>
      </IonItem>
      <IonItem>
      <IonInput label={t("general.password") as string} labelPlacement="stacked" autocomplete="current-password" type={remoteState.showMainPassword ? "text" : "password"} value={remoteState.password} onIonInput={(e) => {setRemoteState(prevstate => ({...prevstate, password: String(e.detail.value)}))}}>
      </IonInput><IonIcon slot="end"  icon={remoteState.showMainPassword ? eyeOff : eye} onClick={() => {setRemoteState((prevState) => ({...prevState,showMainPassword: !prevState.showMainPassword}))}}></IonIcon>
      </IonItem>
      <IonItem>
      <IonInput label={t("general.confirm_password") as string} labelPlacement="stacked" autocomplete="current-password" type={remoteState.showVerifyPassword ? "text" : "password"} value={remoteState.verifyPassword} onIonInput={(e) => {setRemoteState(prevstate => ({...prevstate, verifyPassword: String(e.detail.value)}))}}>
      </IonInput><IonIcon slot="end"  icon={remoteState.showVerifyPassword ? eyeOff : eye} onClick={() => {setRemoteState((prevState) => ({...prevState,showVerifyPassword: !prevState.showVerifyPassword}))}}></IonIcon>
      </IonItem>
      </>
    }
  } else {
    formElem = <>
      <IonItem>
        <IonText>
          {t("error.database_server_not_available_choose_work_offline")}
        </IonText>
      </IonItem>
    </>

  }
  let buttonsElem
  if (remoteDBState.serverAvailable) {
    if (!remoteState.inCreateMode) {
      buttonsElem=<>

        <IonButton size="small" slot="start" onClick={() => submitForm()}>{t("general.login")}</IonButton>
        {/* <IonButton onClick={() => workOffline()}>Work Offline</IonButton> */}        
        <IonButton size="small" onClick={() => resetPassword()}>{t("general.reset_password")}</IonButton>
        <IonButton size="small" slot="end" onClick={() => setRemoteState(prevState => ({...prevState,inCreateMode: true, formError: ""}))}>{t("general.create_account")}</IonButton>

      </>
    } else {
      buttonsElem=<>

        <IonButton fill="outline" onClick={() => setRemoteState(prevState => ({...prevState,inCreateMode: false}))}>{t("general.cancel")}</IonButton>
        <IonButton onClick={() => submitCreateForm()}>{t("general.create")}</IonButton>

      </>
    }
  } else {
    buttonsElem=<>
      <IonItem>
        <IonButton slot="start" onClick={() => setWorkingOffline()}>{t("general.work_offline")}</IonButton>
      </IonItem>
    </>
  }

  return(
        <IonPage>
            <IonHeader><IonToolbar>
            <IonButtons slot="start"><IonMenuButton /></IonButtons>
            <IonTitle>
            {t("general.login_page")}
            </IonTitle></IonToolbar></IonHeader>
            <IonContent>
            <IonList>
              {formElem}
              <IonItem>
                  <IonText>{remoteState.formError}</IonText>
              </IonItem>
              {buttonsElem}
            </IonList>
            </IonContent>

        </IonPage>
    )
}

export default RemoteDBLogin;