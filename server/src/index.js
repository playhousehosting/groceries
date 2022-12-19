const express = require('express');
const cors = require('cors');
const eta = require('eta');
const app = express();
const { issueToken, checkUserExists, registerNewUser, dbStartup, getUsersInfo, 
        checkUserByEmailExists, createAccountUIGet, createAccountUIPost } = require('./userfunctions');

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({extended: true}));

app.engine("eta", eta.renderFile);
app.set("view engine","eta");
app.set("views","./views");

app.post('/issuetoken', async (req, res) => res.send(await issueToken(req,res)));
app.post('/checkuserexists', async (req, res) => res.send(await checkUserExists(req,res)));
app.post('/checkuserbyemailexists', async (req,res) => res.send(await checkUserByEmailExists(req,res)))
app.post('/registernewuser', async (req, res) => res.send(await registerNewUser(req,res)));
app.post('/getusersinfo', async (req, res) => res.send(await getUsersInfo(req,res)));
app.get('/test', async (req,res) => res.render("test", {favorite: "Movies", reasons: ["background","action"]}))
app.get('/createaccountui', async (req,res) => await res.render("createaccount",await createAccountUIGet(req,res)))
app.post('/createaccountui', async (req,res) => res.send(await createAccountUIPost(req,res)));

//TODO refreshtoken
//TODO setuserdata (including password)

dbStartup();

app.listen(process.env.COUCHDB_API_PORT);