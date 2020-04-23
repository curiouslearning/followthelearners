const express = require('express');
const http = require('http');
const {BigQuery} = require ('@google-cloud/bigquery');
const fireStoreAdmin = require('firebase-admin');
let serviceAccount = require('./keys/firestore-key.json');
const bodyParser = require('body-parser');
const app = express();


fireStoreAdmin.initializeApp({
  credential: fireStoreAdmin.credential.cert(serviceAccount)
});

let firestore = fireStoreAdmin.firestore();
app.use('/media', express.static(__dirname + '/media'));
app.set('view engine', 'pug');
app.use(bodyParser.urlencoded({ extended: true}));

app.post('/submit', function(req, res){
  RegisterDonation(req.body.user, req.body.donation);
  res.send("Thank you for your donation!");
});

app.post('/viewRegion', function (req, res) {
  viewRegionSupporters(req, res);
});

app.post('/viewLearners', function (req, res){
  viewLearnersForDonor(req, res);
});

app.post('/summary', function(req, res){
  res.redirect('/summary?email=' + req.body.email);
              });
app.get('/summary*', function(req, res){
  res.render('summary');
});

app.post("/viewData", function(req, res) {
  viewSummaryData(req,res);
});
app.get('/', function(req, res){res.render('index');});
app.get('*', function(req, res){res.render('404');});
app.listen(3000);

function viewRegionSupporters(req, res)
{
  let donors = firestore.collection('donor_master');
  let region = req.body.region;
  let campaigns = firestore.collection('campaign_master');
  let donorsForRegion = [];
  campaigns.where("regions", "array-contains", region).get().then(snapshot=>{
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
        console.log(donorCount, " people are supporting the region of ", region);
        let response = donorCount+" people are supporting the region of "+region;
        res.send(response);
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
  let donor = getDonorsForEmail(req.body.email, function(snapshot){
    donorID = snapshot.docs[0].data().donorID;
  }).then(snapshot=>{
    return getCampaignsForDonor(donorID, campaignList);
  }).then(snapshot=>{
    let promises = [];
    campaignList.forEach(id => {
      promises.push(getUsersForCampaign(id, userList));
    });
    return Promise.all(promises).then(results =>{
      let locationPromises = [];
      userList.forEach(doc=>
      {
        console.log(doc);
        locationPromises.push(firestore.collection('location_reference').where('country', '==', doc.region).get().then(snapshot=>{
          if(snapshot.empty){
            console.log('no reference found');
            return;
          }
          snapshot.forEach(doc=>{locations.push(doc.data().streetViews.locations[0]);});
        }));
      });
      return Promise.all(locationPromises).then(results=>{
        console.log(locations);
        res.json({locations: locations});});
    });
  }).catch(err =>{console.log(err)});
}

function viewLearnersForDonor(req, res)
{
  let donors = firestore.collection('donor_master');
  let donorEmail = req.body.email;
  let donorID = 0;
  let campaignList = [];
  let userList = [];
  console.log("searching for donor with email ", donorEmail);
  getDonorsForEmail(donorEmail, function(snapshot){
    donorID = snapshot.docs[0].data().donorID;
    return getCampaignsForDonor(donorID, campaignList);
  }).then(snapshot =>{
    let promises = [];
    campaignList.forEach(campaignID =>
    {
      promises.push(getUsersForCampaign(campaignID, userList));
    });
    return Promise.all(promises).then(snapshot =>{
      let userCount = 0;
      userList.forEach(user => {userCount++;});
      console.log("donorID ", donorID, " has ", userCount, " users associated with it");
      let response = "donorID "+donorID+" has "+userCount+" users associated with it";
      res.send(response);
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
        return firestore.collection('campaign_master').orderBy('campaignID', 'desc').get().then(snapshot =>{
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

function getUsersForCampaign (campaignID, userList) {
  let users = firestore.collection('user_master');
  return users.where('sourceCampaign', '==', campaignID).get().then(
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
  let campaigns = firestore.collection('campaign_master');
  return campaigns.where('sourceDonor', '==', donorID).get().then(snapshot =>{
    if(snapshot.empty) {
      console.log("no campaigns available");
    }
    snapshot.forEach(doc=>
    {
      campaignList.push(doc.data().campaignID);
    });
  });
}

function writeDonorToFirestore(donorObject)
{
    let donorRef = firestore.collection('donor_master').doc();

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
  let campaignRef = firestore.collection('campaign_master').doc();

  let setWithOptions = campaignRef.set({
    campaignID: campaignObject.campaignID,
    sourceDonor: campaignObject.sourceDonor,
    startDate: campaignObject.startDate,
    amount: campaignObject.amount,
    regions: campaignObject.regions,
  }, {merge: true});
}

function generateGooglePlayURL (appID, source, campaignID) {
    return "https://play.google.com/store/apps/details?id=" + appID + "&referrer=utm_source%3D" + source + "%26utm_campaign%3D"+ campaignID;
}

function getDateTime(){
  let today = new Date();
  let date = today.getFullYear()+'-'+(today.getMonth()+1)+'-'+today.getDate();
  let time = today.getHours()+":"+today.getMinutes()+":"+today.getSeconds();
  return date+' '+time;
};
