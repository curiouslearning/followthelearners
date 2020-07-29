const express = require('express');
const http = require('http');
const Memcached = require('memcached');
const fireStoreAdmin = require('firebase-admin');
const serviceAccount = require('./keys/firestore-key.json');
const bodyParser = require('body-parser');
const dateFormat = require('date-format');
const app = express();
const CACHETIMEOUT = 720; // the cache timeout in minutes

fireStoreAdmin.initializeApp({
  credential: fireStoreAdmin.credential.cert(serviceAccount),
});

const firestore = fireStoreAdmin.firestore();
const memcached = new Memcached('127.0.0.1:11211');
const memcachedMiddleware = (duration) => {
  return (req, res, next) => {
    const key = '__express__' + req.originalUrl || req.url;
    memcached.get(key, function(err, data) {
      if (data) {
        res.send(data);
        return;
      } else {
        res.sendResponse = res.send;
        res.send = (body) => {
          memcached.set(key, body, (duration*60), function(err) {
            //
          });
          res.sendResponse(body);
        };
        next();
      }
    });
  };
};
const memcachedDeleteKey = (req)=> {
  const key = '__express__' + req.originalUrl || req.url;
  memcached.del(key, function(err) {
    if (err) {
      console.log(err);
    }
  });
};

app.use('/static', express.static(__dirname + '/static'));
app.set('view engine', 'pug');
app.use(bodyParser.urlencoded({extended: true}));

app.get('/', function(req, res) {
  res.render('landing-page');
});

app.get('/campaigns', function(req, res) {
  const dbRef = firestore.collection('campaigns');
  const campaigns =[];
  dbRef.where('isActive', '==', true).get().then((snapshot)=>{
    if (snapshot.empty) {
      console.log('no active campaigns');
      return;
    }
    snapshot.forEach((doc)=>{
      const data = doc.data();
      console.log('data: ', data);
      campaigns.push({
        country: data.country,
        imgRef: data.imgRef,
        body: data.summary,
        learnerCount: data.learnerCount,
        amount: '5.00',
        campaignID: data.campaignID,
      });
    });
    return campaigns;
  }).then((snapshot)=>{
    res.render('index', {campaigns: campaigns});
  }).catch((err)=> console.error(err));
});

app.get('/donate', function(req, res) {
  const json = {
    campaign: req.query.campaign,
    amount: req.query.amount,
  };
  res.render('donate', json);
});

app.post('/donate', function(req, res) {
  const donorRef = firestore.collection('donor_master');
  getDonorID(req.body.email).then((donorID)=>{
    let donor = {};
    // create record for first time donors
    if (donorID === '' || donorID === undefined || donorID === null) {
      donor = donorRef.doc();
      donor.get().then((doc)=>{
        donorID = doc.id;
        const donorObject ={
          firstName: req.body.firstName,
          lastName: req.body.lastName,
          donorID: doc.id,
          email: req.body.email,
          dateCreated: getDateTime(),
        };
        writeDonorToFirestore(donorObject);
      });
    }
    firestore.collection('campaigns')
        .where('campaignID', '==', req.body.campaign).get().then((snapshot)=>{
          // all donations must be linked to an existing campaign
          if (snapshot.empty) {
            res.render('donate', {
              response: 'Sorry, this is not an active campaign! please choose an active campaign from the home page',
            });
            res.end();
            return;
          }
          const data = snapshot.docs[0].data();
          const donationObject = {
            campaignID: req.body.campaign,
            amount: req.body.amount,
            region: data.country,
            startDate: getDateTime(),
            sourceDonor: donorID,
          };
          writeCampaignToFirestore(donationObject);
          assignInitialLearners(donationObject.sourceDonor,
              donationObject.campaignID,
              donationObject.region);
          res.render('donate', {response: 'Thank you for your donation!'});
          res.end();
        });
  }).catch((err)=>{
    console.error(err);
  });
});

app.get('/getDonorCampaigns', function(req, res) {
  const email = req.query.email;
  getDonorID(email).then((donorID)=>{
    if (donorID === '' || donorID === undefined || donorID === null) {
      res.end();
    }
    return getDonations(donorID);
  }).then((snapshot)=>{
    if (snapshot === undefined || snapshot.empty) {
      res.render('summary');
    }
    const donations = [];
    snapshot.forEach((doc) => {
      donations.push(doc.data);
    });
    return donations;
  }).then((donations)=>{
    // res.render('summary', {campaigns: donations});
    res.json({campaigns: donations});
  }).catch((err)=>{
    console.error(err);
  });
});

app.get('/yourLearners', function(req, res) {
  console.log('Getting learner data for donor: ', req.query.email);
  let donorID = '';
  getDonorID(req.query.email).then((result)=>{
    donorID = result;
    console.log('found donorID: ', donorID);
    return getDonations(donorID);
  }).then((donations)=>{
    if (donations != undefined) {
      const promises = [];
      let locationData = [];
      donations.forEach((donation) => {
        donation.data.countries.forEach((country)=>{
          let objIndex = findObjectIndexWithProperty(
            locationData, 'country', country.country);
          if (objIndex === undefined) {
            promises.push(compileLocationDataForCountry(country.country));
            locationData.push({ country: country.country });
          }
        });
      });
      Promise.all(promises).then((values) => {
        locationData = values.filter((value)=> value !== undefined);
        res.json({campaignData: donations, locationData: locationData});
      });
    } else {
      res.end();
    }
  }).catch((err)=>{
    console.error(err);
  });
});

app.get('/allLearners', function(req, res) {
  console.log('Getting location data for all learners...');
  const dbRef = firestore.collection('loc_ref');
  dbRef.get().then((snapshot) => {
    if (snapshot.empty) {
      res.end();
      return;
    }
    const resData = {campaignData: [], locationData: []};
    snapshot.forEach((doc)=>{
      const data = doc.data();
      if (findObjectIndexWithProperty(
          resData.campaignData, 'country', doc.data().country) === undefined
      ) {
        resData.campaignData.push(extractLearnerDataForCountry(data));
      }
      if (findObjectIndexWithProperty(
          resData.locationData, 'country', doc.data().country) === undefined
      ) {
        resData.locationData.push(extractLocationDataFromCountryDoc(data));
      }
    });
    resData.campaignData.filter((country) => country != undefined);
    resData.locationData.filter((country) => country != undefined);
    res.json({data: resData});
  }).catch((err)=>{
    console.error(err);
    res.end();
  });
});

app.get('/allLearnersCount', function(req, res) {
  console.log('Getting all learners count...');
  getAggregateValue('allLearnersCount').then((count) => {
    if (count) {
      res.json({allLearnersCount: count});
    } else {
      res.end();
    }
  }).catch((err) => {
    console.error(err); res.end();
  });
});

function getAggregateValue(aggregateKey) {
  const aggregateDataQuery = firestore.collection('aggregate_data').doc('data');
  return aggregateDataQuery.get().then((snapshot) => {
    return snapshot.data()[aggregateKey];
  });
}

app.get('*', function(req, res) {
  res.render('404');
});

app.listen(3000);


function getDonorID(email) {
  const dbRef = firestore.collection('donor_master');
  return dbRef.where('email', '==', email).get().then((snapshot)=>{
    if (snapshot.empty) {
      console.log('no donorID found for email ', email);
      return '';
    }
    return snapshot.docs[0].data().donorID;
  }).catch((err)=>{
    console.error(err);
  });
}

function getLearners(donorID) {
  if (donorID === null || donorID === '') {
    return [];
  }
  const donationsRef = firestore.collection('donor_master').doc(donorID)
      .collection('donations');
  donationsRef.get().then((snapshot) => {
    if (snapshot.empty) {
      console.log('no donations for donor with ID ', donorID);
      return 0;
    }
    let learnerSum = 0;
    snapshot.forEach((doc) => {
      learnerSum += doc.data().learnerCount;
    });
    return learnerSum;
  }).catch((err)=>{
    console.error(err);
  });
}

function compileLearnerDataForCountry(country) {
  const dbRef = firestore.collection('loc_ref').doc(country);
  return dbRef.get().then((doc)=>{
    if (!doc.exists) {
      console.log('no country level document exists for ', country);
      return undefined;
    }
    const data = doc.data();
    return extractLearnerDataForCountry(data);
  }).catch((err)=>{
    console.error(err);
  });
}

function extractLearnerDataForCountry(data) {
  const filteredRegions =[];
  data.regions.forEach((region)=>{
    if (region.hasOwnProperty('learnerCount') && region.learnerCount >=0) {
      filteredRegions.push({
        region: region.region,
        learnerCount: region.learnerCount,
      });
    }
  });
  return {
    country: data.country,
    learnerCount: data.learnerCount,
    regions: filteredRegions,
  };
}

function compileLocationDataForCountry(country) {
  const dbRef = firestore.collection('loc_ref').doc(country);
  return dbRef.get().then((doc)=>{
    if (!doc.exists) {
      console.log('no country level document exists for ', country);
      return undefined;
    }
    const data = doc.data();
    return extractLocationDataFromCountryDoc(data);
  }).catch((err)=>{
    console.error(err);
  });
}

function extractLocationDataFromCountryDoc(data) {
  const filteredRegions = [];
  data.regions.forEach((region)=>{
    if (region.hasOwnProperty('learnerCount') && 
      region.hasOwnProperty('streetViews')) {
      filteredRegions.push({
        region: region.region,
        pin: region.pin === undefined ? { lat: 0, lng: 0 } : region.pin,
        streetViews: region.streetViews,
      });
    }
  });
  return {
    country: data.country,
    pin: data.pin,
    facts: data.facts,
    regions: filteredRegions,
  };
}

function sumDonors(region) {
  const dbRef = firestore.collectionGroup('donations');
  return dbRef.where('region', '==', region).get().then((snapshot)=>{
    if (snapshot.empty) {
      return 0;
    }
    const donors = [];
    let count = 0;
    snapshot.forEach((doc)=>{
      const data = doc.data();
      if (!donors.includes(data.sourceDonor)) {
        donors.push(data.sourceDonor);
        count++;
      }
    });
    return count;
  }).catch((err)=>{
    console.error(err);
  });
}

function getDonations(donorID) {
  const dbRef = firestore.collection('donor_master')
      .doc(donorID).collection('donations');
  return dbRef.get().then((snapshot)=>{
    if (snapshot === undefined || snapshot.empty) {
      return [];
    }
    const donations =[];
    snapshot.forEach((doc)=>{
      const data = doc.data();
      data.startDate = dateFormat.asString('MM / dd / yyyy hh:mm',
          data.startDate.toDate());
      donations.push({name: doc.id, data: data});
    });
    return donations;
  }).catch((err)=>{
    console.error(err);
  });
}

function getLearnersForRegion(donorID, region) {
  if (donorID === undefined || donorID === '') {
    return;
  } else if (region === undefined || region === '') {
    return getLearners(donorID);
  }
  const donor = firestore.collection('donor_master').doc(donorID);
  const donation = donor.collection('donations').doc(region);
  return donation.get().then((snapshot)=>{
    if (snapshot.empty) {
      console.log('no donation document exists for ', region); return [];
    }
    return snapshot.data();
  }).catch((err)=>{
    console.error(err);
  });
}

function writeDonorToFirestore(donorObject) {
  console.log('Creating Donor with ID: ', donorObject.donorID);
  const dbRef = firestore.collection('donor_master');
  const donorRef = dbRef.doc(donorObject.donorID.toString());

  const setWithOptions = donorRef.set({
    donorID: donorObject.donorID,
    dateCreated: donorObject.dateCreated,
    lastName: donorObject.lastName,
    firstName: donorObject.firstName,
    email: donorObject.email,
  }, {merge: true});
}

function writeCampaignToFirestore(campaignObject) {
  const dbRef = firestore.collection('donor_master');
  const messageRef = dbRef.doc(campaignObject.sourceDonor)
      .collection('donations').doc(campaignObject.campaignID);
  const setWithOptions = messageRef.set({
    campaignID: campaignObject.campaignID,
    sourceDonor: campaignObject.sourceDonor,
    startDate: campaignObject.startDate,
    amount: Number(campaignObject.amount),
    region: campaignObject.region,
  }, {merge: true});
}

// Grab initial list of learners at donation time from user_pool
// and assign to donor according to donation amount and campaigns cost/learner
function assignInitialLearners(donorID, donationID, country) {
  const donorRef = firestore.collection('donor_master').doc(donorID);
  const donationRef = donorRef.collection('donations').doc(donationID);
  const campaignRef = firestore.collection('campaigns').doc(donationID);
  const poolRef = firestore.collection('user_pool');
  firestore.collection('user_pool').where('country', '==', country)
      .get().then((snapshot)=>{
        if (snapshot.empty) {
          return;
        }
        campaignRef.get().then((doc)=>{
          const costPerLearner = doc.data().costPerLearner;
          return donationRef.get().then((doc)=>{
            return doc.data().amount/costPerLearner;
          });
        }).then((userCount)=>{
          for (let i = 0; i < userCount; i++) {
            if (i >= snapshot.size) {
              break;
            }
            const poolUsrRef = poolRef.doc(snapshot.docs[i].id);
            const usrRef = donationRef.collection('users')
                .doc(snapshot.docs[i].id);
            poolUsrRef.get().then((doc)=>{
              doc.data().sourceDonor = donorID;
              usrRef.set(doc.data(), {merge: true}).then(()=>{
                poolUsrRef.delete();
              });
            });
          }
        });
      }).catch((err)=>{
        console.error(err);
      });
}

function findObjectIndexWithProperty (arr, prop, val) {
  for (let i=0; i < arr.length; i++) {
    if (arr[i].hasOwnProperty(prop) && arr[i][prop] === val) {
      return i;
    }
  }
  return undefined;
}

function generateGooglePlayURL(appID, source, campaignID, donorID) {
  return 'https://play.google.com/store/apps/details?id=' + appID + '&referrer=utm_source%3D' + source + '%26utm_campaign%3D'+ campaignID+'_'+donorID;
}

function getDateTime() {
  return fireStoreAdmin.firestore.Timestamp.now();
}
