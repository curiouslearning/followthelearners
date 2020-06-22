const express = require('express');
const http = require('http');
const Memcached = require('memcached');
const fireStoreAdmin = require('firebase-admin');
let serviceAccount = require('./keys/firestore-key.json');
const bodyParser = require('body-parser');
const dateFormat = require('date-format');
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
  res.render('landing-page');
});

app.get('/campaigns', function(req, res) {
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
      assignInitialLearners(donationObject.sourceDonor, donationObject.campaignID, donationObject.region);
      res.render('donate', {response:"Thank you for your donation!"});
      res.end();
    });
  }).catch(err=>{console.error(err)});
});
app.get('/getDonorCampaigns', function (req, res){
  let donations =[];
  let email = req.query.e;
  getDonorID(email).then(donorID=>{
    if (donorID === "" || donorID === undefined || donorID === null) {
      res.end();
    }
    return getDonations(donorID);
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
    // res.render('summary', {campaigns: donations});
    res.json({campaigns: donations});
  }).catch(err=>{console.error(err)})
});

app.get('/yourLearners', function(req, res){
  console.log('searching for learners for donor ', req.query.email, 'in region ', req.query.campaign)
  let learnerList = [];
  let donorID = "";
  getDonorID(req.query.email).then(result=>{
    donorID = result;
    console.log("found donorID: ", donorID);
    return getLearnersForRegion(donorID, req.query.campaign);
  }).then(learners=>{
    console.log("learners: ", learners);
    if(learners.empty || learners.length == 0){
      return[];
    }else{
      learnerList = learners;
      return getLocDataForRegion(donorID, req.query.campaign, learners);
    }
  }).then(locData=>{
    if(locData != []){
      res.json({learners: learnerList, locData: locData});
    } else {
      res.end();
    }
  }).catch(err=>{console.error(err)});
});

app.get('/allLearners', function(req, res){
  console.log('Getting location data for all learners...');
  let usersList = [];
  getAllUsers().then(users => {
    // usersList = users;
    usersList = users.filter(user => user.country !== null &&
      user.country !== undefined && user.country !== "");
    return getAllLocations();
  }).then(locations => {
    let locData = getLocDataForAllLearners(usersList, locations);
    if (locData !== null && locData !== []) {
      res.json({locData: locData});
    } else {
      res.end();
    }
  }).catch(err => { console.error(err); res.end(); });
});

app.get('/allLearnersCount', function(req, res) {
  console.log('Getting all learners count...');
  getAggregateValue('allLearnersCount').then((count) => {
    if (count) {
      res.json({allLearnersCount: count});
    } else {
      res.end();
    }
  }).catch(err => { console.error(err); res.end(); });
});

function getAggregateValue(aggregateKey) {
  let aggregateDataQuery = firestore.collection('aggregate_data').doc('data');
  return aggregateDataQuery.get().then(snapshot => {
    return snapshot.data()[aggregateKey];
  });
}
function getLocDataForAllLearners(usersList, locations) {
  let locData = { facts: {}, markerData: [] };

  for (let locKey in locations) {
    if (locations[locKey].facts) {
      locData.facts[locations[locKey].country] = locations[locKey].facts;
    }
  }

  usersList.forEach(user => {
    let markerData = { lat: 0, lng: 0, country: user.country,
      region: user.region, headingValue: 0, otherViews: [] };
    let regions = locations[user.country].regions;
    let userRegion = regions.find(reg => {
      if (reg.region === null || reg.region === "" ||reg.region === undefined || user.region === undefined || user.region === null ||
      user.region === "") {
        return false;
      } else {
        return reg.region.toLowerCase() === user.region.toLowerCase();
      }
    });
    if (!userRegion) {
      console.log("User region: ", user.region, " not found in regions of",
        user.country);
      return;
    }
    let streetViews = userRegion.streetViews;

    if (!streetViews || (streetViews.locations === undefined ||
        streetViews.headingValues === undefined) || (streetViews.locations.length !==
        streetViews.headingValues.length) || (streetViews.locations.length === 0|| streetViews.headingValues.length ===0)) {
      console.log("User region: ", user.region,
        " doesn't have proper street view data.");
      return;
    }

    markerData.lat = streetViews.locations[0]._latitude;
    markerData.lng = streetViews.locations[0]._longitude;
    markerData.headingValue = streetViews.headingValues[0];

    if (streetViews.locations.length > 1) {
      for (let i = 1; i < streetViews.locations.length; i++) {
        let m = { lat: 0, lng: 0, headingValue: 0 };
        m.lat = streetViews.locations[i]._latitude;
        m.lng = streetViews.locations[i]._longitude;
        m.headingValue = streetViews.headingValues[i];
        markerData.otherViews.push(m);
      }
    }

    locData.markerData.push(markerData);
  });

  return locData;
}

function getAllLocations() {
  let locationsQuery = firestore.collection('loc_ref');
  return locationsQuery.get().then(snapshot => {
    if (snapshot.empty) {
      console.log("No locations found...");
      return [];
    }
    let locations = [];
    snapshot.forEach(doc => {
      locations[doc.data().country] = doc.data();
    });
    return locations;
  }).catch(err => { console.log(err); });
}

function getAllUsers() {
  let usersQuery = firestore.collectionGroup('users');
  let poolRef = firestore.collection('user_pool');
  let unassignedRef = firestore.collection('unassigned_users');
  return usersQuery.get().then(snapshot => { //get all assigned learners
    if (snapshot.empty) {
      console.log('No users found...');
      return [];
    }
    let users = [];
    console.log(snapshot.size + " assigned users")
    snapshot.forEach(doc => {
      users.push(doc.data());
    });
    return poolRef.get().then(pool=>{ //get all learners in user_pool
      if(!pool.empty)
      {
        console.log(pool.size + " users in pool");
        pool.forEach(doc=>{
          users.push(doc.data());
        })
      }
      return unassignedRef.get().then(unassigned=>{ //get all unassigned learners
        if(!unassigned.empty)
        {
          console.log(unassigned.size + " unassigned users");
          unassigned.forEach(doc=>{
            users.push(doc.data());
          });
        }
        console.log("found: " + users.length + " users");
        return users;
      });
    });
  }).catch(err => { console.error(err); });
}

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

function getLocDataForRegion(donorID, region, learners)
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
    return locRef.doc(data.region).get().then(doc=> {
      console.log("loc data: " + data.region);
      if(!doc.exists){ return []; }
      let regions = doc.data().regions;
      let facts = doc.data().facts;
      let locData = { facts: {}, markerData: [] };
      locData.facts[data.region] = facts;
      learners.forEach(learner => {
        let markerData = { lat: 0, lng: 0, country: data.region, region: "", headingValue: 0,
          otherViews: [] };
        let learnerRegion = regions.find(reg =>
          reg.region.toLowerCase() === learner.region.toLowerCase());
        let streetViews = learnerRegion.streetViews;

        if (!streetViews && !streetViews.locations &&
            !streetViews.headingValues && streetViews.locations.length !==
            streetViews.headingValues.length) {
          markerData.push(null);
          return;
        }
        markerData.region = learner.region;
        markerData.lat = streetViews.locations[0]._latitude;
        markerData.lng = streetViews.locations[0]._longitude;
        markerData.headingValue = streetViews.headingValues[0];

        if (streetViews.locations.length > 1) {
          for (let i = 1; i < streetViews.locations.length; i++) {
            let m = { lat: 0, lng: 0, headingValue: 0 };
            m.lat = streetViews.locations[i]._latitude;
            m.lng = streetViews.locations[i]._longitude;
            m.headingValue = streetViews.headingValues[i];
            markerData.otherViews.push(m);
          }
        }

        locData.markerData.push(markerData);
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
      let data = doc.data();
      data.startDate = dateFormat.asString("MM / dd / yyyy hh:mm",
        data.startDate.toDate());
      donations.push({name: doc.id, data: data});
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
        region: data.region,
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
    amount: Number(campaignObject.amount),
    region: campaignObject.region,
  }, {merge: true});
}

//Grab initial list of learners at donation time from user_pool
//and assign to donor according to donation amount and campaigns cost/learner
function assignInitialLearners(donorID, donationID, country)
{
  let donorRef = firestore.collection('donor_master').doc(donorID);
  let donationRef = donorRef.collection('donations').doc(donationID);
  let campaignRef = firestore.collection('campaigns').doc(donationID);
  firestore.collection('user_pool').where('country', '==', country).get().then(snapshot=>{
    if(snapshot.empty){return;}
    campaignRef.get().then(doc=>{
      let costPerLearner = doc.data().costPerLearner;
      return donationRef.get().then(doc=>{return doc.data().amount/costPerLearner;});
    }).then(userCount=>{
      for(let i = 0; i < userCount; i++)
      {
        if(i >= snapshot.size)
        {
          break;
        }
        let poolRef = firestore.collection('user_pool').doc(snapshot.docs[i].id);
        let usrRef = donationRef.collection('users').doc(snapshot.docs[i].id);
        poolRef.get().then(doc=>{
          doc.data().sourceDonor = donorID;
          usrRef.set(doc.data(), {merge:true}).then(()=>{
            poolRef.delete();
          });
        });
      }
    });
  }).catch(err=>{console.error(err);});
}

function generateGooglePlayURL (appID, source, campaignID, donorID) {
    return "https://play.google.com/store/apps/details?id=" + appID + "&referrer=utm_source%3D" + source + "%26utm_campaign%3D"+ campaignID+'_'+donorID;
}

function getDateTime(){
  // let today = new Date();
  // let date = today.getFullYear()+'-'+(today.getMonth()+1)+'-'+today.getDate();
  // let time = today.getHours()+":"+today.getMinutes()+":"+today.getSeconds();
  return fireStoreAdmin.firestore.Timestamp.now();
  //return date+' '+time;
}
