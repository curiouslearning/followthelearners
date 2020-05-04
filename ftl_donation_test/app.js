const express = require('express');
const http = require('http');
const Memcached = require('memcached');
const fireStoreAdmin = require('firebase-admin');
let serviceAccount = require('./keys/firestore-key.json');
const bodyParser = require('body-parser');
const app = express();
const CACHETIMEOUT = 720; //the cache timeout in minutes


fireStoreAdmin.initializeApp({
  credential: fireStoreAdmin.credential.cert(serviceAccount)
});

let firestore = fireStoreAdmin.firestore();
let memcached = new Memcached("127.0.0.1:11211");
let memcachedMiddleware = (duration) => {
        return  (req,res,next) => {
        let key = "__express__" + req.originalUrl || req.url;
        memcached.get(key, function(err,data){
            if(data){
                res.send(data);
                return;
            }else{
                res.sendResponse = res.send;
                res.send = (body) => {
                    memcached.set(key, body, (duration*60), function(err){
                        //
                    });
                    res.sendResponse(body);
                }
                next();
            }
        });
    }
};

let memcachedDeleteKey = (req)=> {
  let key = "__express__" + req.originalUrl || req.url;
  memcached.del(key, function(err){
    if(err){
      console.log(err);
    }
  });
}

app.use('/static', express.static(__dirname + '/static'));
app.set('view engine', 'pug');
app.use(bodyParser.urlencoded({ extended: true}));

app.post('/submit', function(req, res){
  RegisterDonation(req.body.user, req.body.donation);
  res.send("Thank you for your donation!");
});

app.get('activeCampaigns', memcachedMiddleware(CACHETIMEOUT), function(req,res){
  let dbRef = firestore.collection('loc_ref');
  dbRef.get().then(snapshot=>{
      if(snapshot.empty){
        console.log("no active campaigns");
        return;
      }
      let campaigns = [];
      snapshot.forEach(doc => {
        let data = doc.data();
        campaigns.push({
          country: data.country,
          body: data.summary,
          imgRef: data.headerImg,
          donateRef: data.donationLink
        });
      });
      res.json(campaigns);
      res.end();
  }).catch(err=>{console.log(err)});
});

app.get('/viewRegion', memcachedMiddleware(CACHETIMEOUT), function (req, res) {
  viewRegionSupporters(req, res);
});

app.get('/viewLearners',memcachedMiddleware(CACHETIMEOUT), function (req, res){
  viewLearnersForDonor(req, res);
});

// app.get('/summary', function(req, res){
//   res.redirect('/summary?email=' + req.query.email);
// });
app.get('/summary*', function(req, res){
  res.render('summary');
});

app.get("/viewData", memcachedMiddleware(CACHETIMEOUT), function(req, res) {
  viewSummaryData(req,res);
});
app.get('/', function(req, res){res.render('index');});
app.get('*', function(req, res){res.render('404');});
app.listen(3000);


function viewRegionSupporters(req, res)
{
  let donors = firestore.collection('donor_master');
  let region = req.query.region;
  let campaigns = firestore.collectionGroup('donations');
  let donorsForRegion = [];
  campaigns.where("region", "==", region).get().then(snapshot=>{
    if(snapshot.empty){
      console.log("no campaigns associated with region, ", region);
      return;
    }
    let donorPromises =[];
    snapshot.forEach(doc => {
      let donorID = doc.data().sourceDonor;
      donorPromises.push(getCampaignSourceDonor(donorID, function pushDonorEmail(snapshot) {if(snapshot.empty){
          console.log("no donor found for donorID: ", doc.data().sourceDonor);
        }
        if(!donorsForRegion.includes(snapshot.docs[0].data().email)){
          donorsForRegion.push(snapshot.docs[0].data().email);
        }
      }));
    });
      return Promise.all(donorPromises).then(snapshot=> {
        let donorCount = 0;
        donorsForRegion.forEach(donor =>
        {
          donorCount++;
        });

        if(donorCount == 1){
          console.log(donorCount, " person is supporting the region of ", region);
           res.send( donorCount+" person is supporting the region of "+region);
        }else{
          console.log(donorCount, " people are supporting the region of ", region);
          res.send(donorCount+" people are supporting the region of "+region);
        }
      });
  }).catch(err =>{
    console.log("Encountered an error fetching the donors for region! Error: ", err);
  });
}

function viewSummaryData(req, res)
{
  let donorID = ""
  let campaignList =[];
  let userList = [];
  let locations = [];
  let donor = getDonorsForEmail(req.query.email, function(snapshot){
    donorID = snapshot.docs[0].data().donorID;
  }).then(snapshot=>{
    return getUsersForDonor(donorID).get();
  }).then(snapshot=>{
    if(snapshot.empty){
      console.log("no users for this donor!");
      return;
    }
    let locationPromises = [];
    snapshot.forEach(doc=>
    {
      console.log(doc);
      locationPromises.push(firestore.collection('location_reference').where('country', '==', doc.data().region).get().then(snapshot=>{
        if(snapshot.empty){
          console.log('no reference found');
          return;
        }
        snapshot.forEach(doc=>{locations.push(doc.data().streetViews.locations[0]);});
      }));
    });
    return Promise.all(locationPromises).then(results=>{
      console.log(locations);
      res.json({locations: locations});
    });
  }).catch(err =>{console.log(err);});
}

function viewLearnersForDonor(req, res)
{
  let donors = firestore.collection('donor_master');
  let donorEmail = req.query.email;
  let donorID = 0;
  let campaignList = [];
  let userList = [];
  console.log("searching for donor with email ", donorEmail);
  getDonorsForEmail(donorEmail, function(snapshot){
    donorID = snapshot.docs[0].data().donorID;
  }).then(snapshot =>{
      return getUsersForDonor(donorID).get().then(snapshot=>{
          let userCount = 0;
          snapshot.forEach(user => {userCount++;});
          if(userCount == 1){
            console.log("donorID ", donorID, " has ", userCount, " user associated with it");
            res.send("donorID "+donorID+" has "+userCount+" user associated with it");
          }else{
            console.log("donorID ", donorID, " has ", userCount, " users associated with it");
            res.send("donorID "+donorID+" has "+userCount+" users associated with it");
          }
        });
  }).catch(err => {
      console.log("Encountered an error!", err);
    });
}

function RegisterDonation (user, donation)
{
  const email = user.email;
  const lastName = user.lastName;
  const firstName = user.firstName;
  const amount = donation.amount;
  const regions = donation.regions;
  let donorID = null;


  const currentDateTime = getDateTime();
  let campaign_url = "";

  let donorObject = {
    donorObject: "",
    dateCreated: currentDateTime,
    lastName: lastName,
    firstName: firstName,
    email : email,
  };
  console.log("searching for donor with email: ", donorObject.email);

    let dbRef = firestore.collection('donor_master');
    let query = dbRef.where('email', '==', donorObject.email).limit(1).get().then(
      snapshot => {
        if(snapshot.empty){
          console.log("no matching donor record found, creating a new one")
          dbRef.orderBy('donorID', 'desc').get().then(snapshot => {
            donorObject.donorID = snapshot.size;
            writeDonorToFirestore(donorObject);
          });
        }
      else {
          donorObject.donorID = snapshot.docs[0].data().donorID
      }
        return dbRef.collection('donations').orderBy('campaignID', 'desc').get().then(snapshot =>{
          return snapshot.size;
        });
      }).then(campaignIDTxn => {
        let campaignObject = {
          campaignID: campaignIDTxn,
          sourceDonor: donorObject.donorID,
          startDate: currentDateTime,
          amount: amount,
          regions: [regions],
          appID: 'com.eduapp4Syria.feedthemonsterENGLISH',
        };
        campaign_url = generateGooglePlayURL(campaignObject.appID, 'ftl-donation', campaignObject.campaignID);
        writeCampaignToFirestore(campaignObject);
        return ("Thank you for your donation!");
      }).catch(err => {
        console.log("An Error was encountered: ", err);
      });
          //TODO: Instrument BigQuery historical archiving
          //write donorObject to donors.json.
          //write campaignObject to campaigns.JSON.
}
  function getDonorsForEmail(email, callback){
    console.log("searching for email ", email);
    let donors = firestore.collection('donor_master');
    return donors.where('email', '==', email).get().then(snapshot=>{
      if(snapshot.empty){
        console.log("no data for this email");
        return;
      }
      console.log('found donor that matches this e-mail');
      callback(snapshot);
    }).catch(err=>{console.log(err);});
  }
function getCampaignSourceDonor(donorID, result)
{
  let donors = firestore.collection('donor_master');
  return donors.where("donorID", "==", donorID).get().then(snapshot=>{
        result(snapshot);
      });
}

function getUsersForCampaign (donorID, campaignID, userList) {
  let users = firestore.collection('donor_master').document(donorID).collection("donations").document(campaignID).collection('users');
  return users.get().then(
  snapshot => {
    if(snapshot.empty) {
      console.log("no users for campaign: ", campaignID);
    }
    else{
      snapshot.forEach(doc =>
      {
        userList.push(doc.data());
      });
    }
  });
}

function getCampaignsForDonor(donorID, campaignList)
{
  let campaigns = firestore.collection('donor_master').document(donorID).collection('donations');
  return campaigns.get().then(snapshot =>{
    if(snapshot.empty) {
      console.log("no campaigns available");
    }
    snapshot.forEach(doc=>
    {
      campaignList.push(doc.data().campaignID);
    });
  });
}

function getUsersForDonor(donorID)
{
  let db = firestore.collectionGroup('users');
  return db.where('sourceDonor', '==', donorID);
}

function writeDonorToFirestore(donorObject)
{
    let donorRef = firestore.collection('donor_master').document(donorObject.donorID);

    let setWithOptions = donorRef.set({
      donorID: donorObject.donorID,
      dateCreated: donorObject.dateCreated,
      lastName: donorObject.lastName,
      firstName: donorObject.firstName,
      email: donorObject.email,
    },{merge: true});
}

function writeCampaignToFirestore(campaignObject)
{
  let firestore = firestore.collection('donor_master');
  let messageRef = firestore.document(campaignObject.sourceDonor).collection("donations").document(campaignObject.campaignID);
  let setWithOptions = messageRef.set({
    campaignID: campaignObject.campaignID,
    sourceDonor: campaignObject.sourceDonor,
    startDate: campaignObject.startDate,
    amount: campaignObject.amount,
    regions: campaignObject.regions,
  }, {merge: true});
}

function generateGooglePlayURL (appID, source, campaignID, donorID) {
    return "https://play.google.com/store/apps/details?id=" + appID + "&referrer=utm_source%3D" + source + "%26utm_campaign%3D"+ campaignID+'_'+donorID;
}

function getDateTime(){
  let today = new Date();
  let date = today.getFullYear()+'-'+(today.getMonth()+1)+'-'+today.getDate();
  let time = today.getHours()+":"+today.getMinutes()+":"+today.getSeconds();
  return date+' '+time;
};
