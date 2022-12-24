import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar, IonButton, IonList, IonInput, IonItem,
  IonButtons, IonMenuButton, IonItemDivider, IonLabel, IonSelect, IonCheckbox, IonIcon,
  IonSelectOption, NavContext, useIonAlert } from '@ionic/react';
import { addOutline } from 'ionicons/icons';
import { RouteComponentProps, useParams } from 'react-router-dom';
import { usePouch, useDoc, useFind } from 'use-pouchdb';
import { useState, useEffect, useContext } from 'react';
import { useCreateGenericDocument, useUpdateGenericDocument } from '../components/Usehooks';
import { createEmptyItemDoc } from '../components/DefaultDocs';
import { GlobalStateContext } from '../components/GlobalState';
import { cloneDeep, isEmpty } from 'lodash';
import './Item.css';
import SyncIndicator from '../components/SyncIndicator';

interface ItemPageProps
  extends RouteComponentProps<{
    id: string;
  }> {}

const Item: React.FC<ItemPageProps> = () => {

  let { mode, itemid: routeItemID  } = useParams<{mode: string, itemid: string}>();
  if ( mode === "new" ) { routeItemID = "<new>"};
  const [needInitItemDoc,setNeedInitItemDoc] = useState((mode === "new") ? true: false);
  const [stateItemDoc,setStateItemDoc] = useState({});
  const updateItem  = useUpdateGenericDocument();
  const addItem = useCreateGenericDocument();
  const { doc: itemDoc, loading: itemLoading, state: itemState, error: itemError } = useDoc(routeItemID);
  const { docs: listDocs, loading: listLoading, error: listError} = useFind({
    index: { fields: ["type","name"] },
    selector: { type: "list", name: { $exists: true} },
    sort: [ "type","name"]
  });

  const { docs: categoryDocs, loading: categoryLoading, error: categoryError } = useFind({
      index: { fields: [ "type","name"] },
      selector: { type: "category", name: { $exists: true}},
      sort: [ "type","name"]
  });

  const {goBack} = useContext(NavContext);
  const { globalState, setStateInfo} = useContext(GlobalStateContext);
  const [presentAlert, dismissAlert] = useIonAlert();
  const db = usePouch();

  function addListsIfNotExist(itemDoc: any) {
    let newItemDoc=cloneDeep(itemDoc);
    for (let i = 0; i < listDocs.length; i++) {
      let foundIdx=newItemDoc.lists.findIndex((el: any) => el.listID === listDocs[i]._id)
      if (foundIdx === -1) {
        newItemDoc.lists.push({
          listID: listDocs[i]._id,
          completed: false,
          active: false,
          boughtCount: 0
        })
      }  
    }
    return(newItemDoc);
  }

  useEffect( () => {
    let newItemDoc = cloneDeep(itemDoc);
    if (!itemLoading && !listLoading) {
      if (globalState.itemMode === "new" && needInitItemDoc) {
        newItemDoc = createEmptyItemDoc(listDocs,globalState.callingListID,globalState.newItemName)
        setStateInfo("newItemMode","none");
        setNeedInitItemDoc(false);
      } else {
      newItemDoc=addListsIfNotExist(itemDoc);
      }
      setStateItemDoc(newItemDoc as any);
    }
  },[itemLoading,itemDoc,listLoading,listDocs,globalState.itemMode,globalState.newItemName, globalState.callingListID]);

  if (itemLoading || listLoading || categoryLoading || isEmpty(stateItemDoc))  {
    return(
    <IonPage><IonHeader><IonToolbar><IonTitle>Loading...</IonTitle></IonToolbar></IonHeader></IonPage>
  )};
  
  function updateThisItem() {
    if (mode === "new") {
      addItem(stateItemDoc);
    }  
    else {
      updateItem(stateItemDoc);
    }
    goBack("/lists");
  }

  function updateCategory(catID: string) {
    setStateItemDoc({
      ...stateItemDoc,
      categoryID: catID
    });
  }

  async function addNewCategory(category: string) {
    console.log("added new category");
    let alreadyFound=false;
    categoryDocs.forEach((cat: any) => 
      {
        if (category.toUpperCase() == cat.name.toUpperCase()) {alreadyFound=true}
      });
    console.log("found: ",{alreadyFound})
    if (!alreadyFound) {
      let result = await db.post({"type": "category", "name": category})
      console.log(result);
      updateCategory(result.id)
    }  
  }

  function addCategoryPopup() {
    presentAlert({
      header: "Add new category",
      inputs: [ {name: "category", type: "text"}],
      buttons: [ { text: 'Cancel', role: 'cancel'},
                { text: "Add", role: 'confirm',
                handler: (alertData) => {addNewCategory(alertData.category)}}
                ]    
    })

  }

  function selectList(listID: string, updateVal: boolean) {
    let newItemDoc=cloneDeep(stateItemDoc);
    let listFound=false
    for (let i = 0; i < newItemDoc.lists.length; i++) {
      if (newItemDoc.lists[i].listID === listID) {
        newItemDoc.lists[i].active = updateVal;
        listFound=true;
        if(updateVal) {newItemDoc.lists[i].boughtCount++}
      }    
    }
    if (!listFound) {
      let listobj={
        listID: listID,
        boughtCount: 0,
        active: updateVal,
        checked: false
      }
      newItemDoc.lists.push(listobj);
    }
    setStateItemDoc(newItemDoc);
  }

  let listsElem=[];
  listsElem.push(<IonItemDivider key="listdivider">Item is on these lists:</IonItemDivider>)
  for (let i = 0; i < (stateItemDoc as any).lists.length; i++) {
    let listID = (stateItemDoc as any).lists[i].listID;
    let itemFoundIdx=listDocs.findIndex(element => (element._id === listID));
    let itemActive=((itemFoundIdx !== -1) && ((stateItemDoc as any).lists[i].active));
    let listName=(itemFoundIdx !== -1) ? (listDocs as any)[itemFoundIdx].name : "Undefined list: "+listID;
    listsElem.push(
      <IonItem key={listID}>
        <IonCheckbox slot="start" onIonChange={(e: any) => selectList(listID,Boolean(e.detail.checked))} checked={itemActive}></IonCheckbox>
        <IonLabel>{listName}</IonLabel>
      </IonItem>
    )
  }
  
  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
        <IonButtons slot="start"><IonMenuButton /></IonButtons>
          <IonTitle>Editing Item: {(stateItemDoc as any).name}</IonTitle>
          <SyncIndicator />
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <IonHeader collapse="condense">
          <IonToolbar>
            <IonTitle size="large">Editing Item: {(stateItemDoc as any).name}</IonTitle>
          </IonToolbar>
        </IonHeader>
          <IonList>
            <IonItem key="name">
              <IonLabel position="stacked">Name</IonLabel>
              <IonInput type="text" onIonChange={(e: any) => setStateItemDoc({...stateItemDoc, name: e.detail.value})} value={(stateItemDoc as any).name}></IonInput>
            </IonItem>
            <IonItem key="quantity">
              <IonLabel position="stacked">Quantity</IonLabel>
              <IonInput type="number" min="0" max="9999" onIonChange={(e: any) => setStateItemDoc({...stateItemDoc, quantity: e.detail.value})} value={(stateItemDoc as any).quantity}></IonInput>
            </IonItem>
            <IonItem key="category">
              <IonLabel position="stacked">Category</IonLabel>
              <IonSelect interface="popover" onIonChange={(ev) => updateCategory(ev.detail.value)} value={(stateItemDoc as any).categoryID}>
                <IonSelectOption key="cat-undefined" value={null}>Uncategorized</IonSelectOption>
                {categoryDocs.map((cat) => (
                    <IonSelectOption key={cat._id} value={(cat as any)._id}>
                      {(cat as any).name}
                    </IonSelectOption>
                ))}
              </IonSelect>
              <IonButton slot="end" fill="clear" onClick={(e: any) => {addCategoryPopup()}}>
                <IonIcon slot="end" icon={addOutline} ></IonIcon>
              </IonButton>  
            </IonItem>
            {listsElem}
          </IonList>
          <IonButton onClick={() => goBack("/lists")}>Cancel</IonButton>
          <IonButton onClick={() => updateThisItem()}>{mode === "new" ? "Add": "Update"}</IonButton>
      </IonContent>
    </IonPage>
  );
};

export default Item;
