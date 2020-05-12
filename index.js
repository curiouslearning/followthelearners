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

app.get('/', function (req, res){
  let dbRef = firestore.collection('campaigns');
  let campaigns =[];
  dbRef.where('isActive', '==', true).get().then(snapshot=>{
    if(snapshot.empty){
      console.log('no active campaigns');
      return;
    }
    snapshot.forEach(doc=>{
      let data = doc.data();
      console.log("data: ", data);
      campaigns.push({
        country: data.country,
        imgRef: data.imgRef,
        body: data.summary,
        amount: '5.00',
        campaignID: data.campaignID
      });
    });
    return campaigns;
  }).then(snapshot=>{
    res.render('index', {campaigns: campaigns});
  }).catch(err=> console.error(err));
});

app.get('/donate', function(req, res){
  let json = {
    campaign: req.query.campaign,
    amount: req.query.amount,
  };
  res.render('donate', json);
});

app.post('/donate', function (req, res){
  let donorRef = firestore.collection('donor_master');
  getDonorID(req.body.email).then(donorID=>{
    let donor = {};
    if(donorID === "" || donorID === undefined || donorID === null){ //create record for first time donors
      donor = donorRef.doc();
      donor.get().then(doc=>{
        donorID = doc.id;
        let donorObject ={
          firstName: req.body.firstName,
          lastName: req.body.lastName,
          donorID: doc.id,
          email: req.body.email,
          dateCreated: getDateTime()
        };
        writeDonorToFirestore(donorObject);
      });
    }
    let campaign = firestore.collection('campaigns').where('campaignID', '==', req.body.campaign).get().then(snapshot=>{
      if(snapshot.empty){ //all donations must be linked to an existing campaign
        res.render('donate', {response:"Sorry, this is not an active campaign! please choose an active campaign from the home page"});
        res.end();
        return;
      }
      let data = snapshot.docs[0].data();
      let donationObject = {
        campaignID: req.body.campaign,
        amount: req.body.amount,
        region: data.country,
        startDate: getDateTime(),
        sourceDonor: donorID,
      };
      writeCampaignToFirestore(donationObject);
      res.render('donate', {response:"Thank you for your donation!"});
      res.end();
    });
  }).catch(err=>{console.error(err)});
});

app.get('/summary*', function (req, res){
  let donations =[];
  let email = req.query.e;
  getDonorID(email).then(donorID=>{
    return getDonations(donorID)
  }).then(snapshot=>{
    if(snapshot.empty){res.render('summary');}
    let promises = []
    snapshot.forEach(donation=>{
      promises.push(getUsersInDonation(donation.data.sourceDonor, donation.name).then(list=>{
        donation.data.userCount = list.length;
        donations.push(donation);
      }));
    });
    return Promise.all(promises);
  }).then(snapshot=>{
    res.render('summary', {campaigns: donations});
  }).catch(err=>{console.error(err)})
});

app.get('/viewData', function(req, res){
  console.log('searching for learners for donor ', req.query.email, 'in region ', req.query.campaign)
  let learnerList = [];
  let donorID =""
  getDonorID(req.query.email).then(result=>{
    donorID = result;
    console.log("found donorID: ", donorID);
    return getLearnersForRegion(donorID, req.query.campaign);
  }).then(learners=>{
    console.log("learners: ", learners);
    if(learners.empty || learners.length == 0){
      return[];
    }else{
      learnerList = learners
      return getLocDataForRegion(donorID, req.query.campaign);
    }
  }).then(locData=>{
    if(locData != []){
      res.json({learners: learnerList, locations: locData});
    }
    else {
      res.end();
    }
  }).catch(err=>{console.error(err)});
});
app.get('*', function(req,res){res.render('404')});

app.listen(3000);


function getDonorID(email)
{
    let dbRef = firestore.collection('donor_master')
    return dbRef.where('email', '==', email).get().then(snapshot=>{
      if(snapshot.empty){
        console.log("no donorID found for email ", email);
        return "";
      }
      return snapshot.docs[0].data().donorID;
    }).catch(err=>{console.error(err)});
}

function getLocDataForRegion(donorID, region)
{
  if(donorID === undefined || region === undefined){console.error("donor and region cannot be undefined!"); return[];}
  else{console.log("donor: ", donorID, " , region: ", region);}
  let locRef = firestore.collection('loc_ref');
  let dbRef = firestore.collection('donor_master').doc(donorID);
  let donation = dbRef.collection('donations').doc(region);
  return donation.get().then(doc =>{
    if(!doc.exists){return [];}
    let data = doc.data();
    console.log("country is: ", data.region);
    return locRef.doc(data.region).get().then(doc=>{
      console.log("loc data: " + data.region);
      if(!doc.exists){ return []; }
      let regions = doc.data().regions;
      let facts = doc.data().facts;
      let locData = {country: data.region, facts: facts, markerData: []};

      regions.forEach(region=>{
        console.log('region is: ', region);
        if(typeof region != 'string'){
          for (var i = 0; i < region.streetViews.locations.length; i++)
          {
            var location = region.streetViews.locations[i];
            console.log("location: ", location)

            var heading = region.streetViews.headingValues[i];

            locData.markerData.push(
            {
              lat: location._latitude, lng: location._longitude, region: region.region, headingValue: heading
            });
          }
        }
      });
      return locData;
    });
  }).catch(err=>{console.error(err)});
}

function getUsersInDonation(donorID, donationID)
{
  let dbRef = firestore.collection('donor_master').doc(donorID);
  let users = dbRef.collection('donations').doc(donationID).collection('users');
  return users.get().then(snapshot=>{
    if(snapshot.empty){console.log("no users in donation", donationID); return [];}
    let userList = [];
    snapshot.forEach(doc=>{
      let data = doc.data();
      userList.push(data);
    });
    return userList;
  }).catch(err=>{console.error(err)});
}

function getLearners(donorID)
{
    if(donorID === null || donorID === ""){return [];}
    let dbRef = firestore.collectionGroup('users');
    return dbRef.where('sourceDonor', '==', donorID).get().then(snapshot=>{
      if(snapshot.empty){console.log("no users for donor ", donorID); return [];}
      let users =[];
      snapshot.forEach(doc=>{
        users.push(doc.data());
      });
      return users;
    }).catch(err=>{console.error(err)});
}

function sumDonors(region)
{
  let dbRef = firestore.collectionGroup('donations');
  return dbRef.where('region', '==', region).get().then(snapshot=>{
    if(snapshot.empty){return 0;}
    let donors = [];
    let count = 0;
    snapshot.forEach(doc=>{
      let data = doc.data();
      if(!donors.includes(data.sourceDonor)){
        donors.push(data.sourceDonor);
        count++;
      }
    });
    return count;
  }).catch(err=>{console.error(err)});
}


function getDonation(donorID, donationID)
{
  let donation = firestore.collection('donor_master').doc(donorID).collection('donations').doc(donationID);
  return donation.get().then(doc=>{
    return doc.data();
  }).catch(err=>{console.error(err)});
}

function getDonations(donorID)
{
  let dbRef = firestore.collection('donor_master').doc(donorID).collection('donations');
  return dbRef.get().then(snapshot=>{
    if(snapshot.empty){return [];}
    let donations =[];
    snapshot.forEach(doc=>{
      donations.push({name: doc.id, data: doc.data()});
    });
    return donations;
  }).catch(err=>{console.error(err)});
}

function getLearnersForRegion(donorID, region)
{
  if(donorID === undefined || donorID === ""){return;}
  else if(region === undefined || region === "") {return getLearners(donorID);}
  let donor = firestore.collection('donor_master').doc(donorID)
  let donation = donor.collection('donations').doc(region);
  let users = donation.collection('users');
  return users.get().then(snapshot=>{
    if(snapshot.empty){console.log("no users for region!", region); return [];}
    let users = [];
    snapshot.forEach(doc=>{
      let data = doc.data();
      users.push({
        region: region,
        sourceCampaign: data.sourceCampaign,
        learnerLevel: data.learnerLevel,
      });
    });
    return users;
  }).catch(err=>{console.error(err)});
}
function writeDonorToFirestore(donorObject)
{
  console.log("Creating Donor with ID: ", donorObject.donorID);
    let donorRef = firestore.collection('donor_master').doc(donorObject.donorID.toString());

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
  let dbRef = firestore.collection('donor_master');
  let messageRef = dbRef.doc(campaignObject.sourceDonor).collection("donations").doc(campaignObject.campaignID);
  let setWithOptions = messageRef.set({
    campaignID: campaignObject.campaignID,
    sourceDonor: campaignObject.sourceDonor,
    startDate: campaignObject.startDate,
    amount: campaignObject.amount,
    region: campaignObject.region,
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
}
