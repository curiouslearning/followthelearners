const functions = require('firebase-functions');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
const cors = require('cors')({origin: true});
const mailConfig = require('../keys/nodemailerConfig.json');
const {Client, Status} = require('@googlemaps/google-maps-services-js');
const {exampleDocumentSnapshot} = require(
    'firebase-functions-test/lib/providers/firestore');

admin.initializeApp();
const transporter = nodemailer.createTransport(mailConfig);
const gmaps = new Client({});

const DEFAULTCPL = 0.25;
const CONTINENTS = [
  'Africa',
  'Americas',
  'Antarctica',
  'Asia',
  'Europe',
  'Oceania',
];

exports.forceRegionRecalculation = functions.https.onRequest(async (req, res)=>{
  const locRef = admin.firestore().collection('loc_ref');
  const batchMax = 495;
  let batchSize = 0;
  let batchCount = 0;
  let batches = [];
  batches[batchCount] = admin.firestore().batch();
  locRef.get().then((snap)=>{
    snap.forEach((doc, i) => {
      if (batchSize >= batchMax) {
        batchSize = 0;
        batchCount++;
        batches[batchCount] = admin.firestore().batch();
      }
      let id = doc.id;
      let data = doc.data();
      let countrySum = 0;
      data.regions.forEach((region, i)=>{
        let index = i;
        updateCountForRegion(data.country, region.region).then((sum)=>{
          data.regions[index].learnerCount = sum;
          countrySum += data.regions[index].learnerCount;
          return;
        }).catch((err)=>{
          console.error(err);
        });
        i++;
      });
      data.learnerCount = countrySum;
      batches[batchCount].set(locRef.doc(id), data, {merge: true});
      batchSize++;
    });
    for (let i=0; i < batches.length; i++) {
      setTimeout((batch, i) =>{
        batch.commit().then(()=>{
          console.log('committed batch ', i);
          return;
        }).catch((err)=>{
          console.error(err);
        });
      }, 1050, batches[i], i);
    }
    res.status(200).end();
    return;
  }).catch((err)=>{
    console.error(err);
    res.status(501).end();
  });
});
exports.clearLearnerPool = functions.https.onRequest(async (req, res)=>{
  const poolRef = admin.firestore().collection('user_pool');
  const batchMax = 495;
  let batchSize = 0;
  let batchCount = 0;
  let batches = [];
  batches[batchCount] = admin.firestore().batch();
  await poolRef.get().then((snapshot)=>{
    if (snapshot.empty) return;
    snapshot.forEach((doc)=>{
      if (batchSize >= batchMax) {
        batchSize = 0;
        batchCount++;
        batches[batchCount] = admin.firestore().batch();
      }
      let id = doc.id;
      batches[batchCount].delete(poolRef.doc(id));
      batchSize++;
    });
    for (let i=0; i < batches.length; i++) {
      setTimeout((batch) =>{
        batch.commit();
      }, 1050, batches[i]);
    }
    return;
  }).catch((err)=>{
    console.error(err);
  });
  res.json({status: 200, message: 'cleared user pool'}).end();
});

exports.logDonation = functions.https.onRequest(async (req, res) =>{
  const splitString = req.body.campaignID.split('|');
  let amount = Number(req.body.amount);
  if (req.body.coveredByDonor) {
    amount = amount - Number(req.body.coveredByDonor);
  }
  const params = {
    firstName: req.body.firstName,
    lastName: req.body.lastName,
    email: req.body.email,
    timestamp: admin.firestore.Firestore.Timestamp.now(),
    amount: amount,
    frequency: req.body.frequency,
    campaignID: splitString[0],
    country: splitString[1],
  };
  writeDonation(params).then((result)=>{
    return res.status(200).send(result);
  }).catch((err)=>{
    console.error(err);
    return res.status(500).send(err);
  });
});

function writeDonation(params) {
  const dbRef = admin.firestore().collection('donor_master');
  let donorID ='';
  return getDonorID(params.email).then((foundID)=>{
    if (foundID === '') {
      return admin.auth().createUser({
        displayName: params.firstName,
        email: params.email,
      }).then((user)=>{
        const uid = user.uid;
        dbRef.doc(uid).set({
          firstName: params.firstName,
          lastName: params.lastName,
          email: params.email,
          dateCreated: params.timestamp,
          donorID: uid,
        });
        return uid;
      });
    } else {
      return foundID;
    }
  }).then((foundID)=>{
    donorID = foundID;
    console.log('id is: ' + donorID);
    if (params.country === 'any') {
      return DEFAULTCPL;
    }
    return getCostPerLearner(params.campaignID);
  }).then((costPerLearner)=>{
    const docRef = dbRef.doc(donorID);
    return docRef.collection('donations').add({
      campaignID: params.campaignID,
      learnerCount: 0,
      sourceDonor: donorID,
      amount: params.amount,
      costPerLearner: costPerLearner,
      frequency: params.frequency,
      countries: [],
      startDate: params.timestamp,
      country: params.country,
    }).then((doc)=>{
      const donationID = doc.id;
      doc.update({donationID: donationID});
      if (params.country === 'any') {
        return assignAnyLearner(donorID, donationID, params.country);
      }
      if (CONTINENTS.includes(params.country)) {
        return assignLearnersByContinent(donorID, donationID, params.country);
      }
      return assignInitialLearners(donorID, donationID, params.country);
    }).then((promise)=>{
      const actionCodeSettings = {
        url: 'http://localhost:3000/campaigns',
        handleCodeInApp: true,
      };
      return admin.auth()
          .generateSignInWithEmailLink(params.email, actionCodeSettings)
          .then((link)=>{
            return generateNewLearnersEmail(
                params.firstName,
                params.email,
                link,
            );
          }).catch((err)=>{
            console.error(err);
          });
    }).catch((err)=>{
      console.error(err);
    });
  }).catch((err) =>{
    console.error(err);
    return err;
  });
}


function updateOldDonorAccount(email, uid) {
  const dbref = firestore.collection('donor_master');
  return dbref.where('email', '==', email).get.then((snap)=>{
    if (snap.empty) return undefined;
    if (snap.docs[0].id !== uid) {
      let id = snap.docs[0].id;
      return dbref.doc(id).update({donorID: uid});
    }
    return undefined;
  })
}

function generateNewLearnersEmail(name, email, url) {
  const capitalized = name.charAt(0).toUpperCase();
  const formattedName = capitalized + name.slice(1);


  const mailOptions = {
    from: 'notifications@curiouslearning.org',
    to: email,
    subject: 'Follow The Learners -- Your Learners are Ready!',
    text: 'Hi '+formattedName+', thank you for helping support Follow the Learners! Click the link below, navigate to the "Your Learners" section, and enter your email to view how we\'re using your donation to bring reading into the lives of children!\n\n'+url+'\n\nFollow the Learners is currently in beta, and we\'re still ironing out some of the wrinkles! If you don\'t see your learners appear after about 5 minutes, please contact support@curiouslearning.org and we will be happy to assist you. ',
  };
  return transporter.sendMail(mailOptions, (error, info)=>{
    if (error) {
      console.error(error);
      promise.reject(error);
    } else {
      console.log('email sent: ' + info.response);
      return;
    }
  });
}

function getCostPerLearner(campaignID) {
  return admin.firestore().collection('campaigns')
      .where('campaignID', '==', campaignID)
      .get().then((snap)=>{
        if (snap.empty) {
          throw new Error('can\'t find campaign with ID: ', campaignID);
        }
        return snap.docs[0].data().costPerLearner;
      }).catch((err)=>{
        console.error(err);
      });
}

function getDonorID(email) {
  return admin.auth().getUserByEmail(email)
      .then((user)=>{
        return user.uid;
      }).catch((err)=>{
        if (err.code === 'auth/user-not-found') {
          console.log('No Donor found for email: ', email);
          return '';
        } else throw new Error(err);
      });
}

function getDonation(donorID, donationID) {
  return admin.firestore().collection('donor_master').doc(donorID)
      .collection('donations').doc(donationID)
      .get().then((doc)=>{
        if (!doc.exists) {
          throw new Error(
              donorID,
              ' is missing Donation Document: ',
              donationID,
          );
        }
        return {id: doc.id, data: doc.data()};
      }).catch((err)=>{
        console.error(err);
      });
}

// Grab initial list of learners at donation time from user_pool
// and assign to donor according to donation amount and campaigns cost/learner
function assignInitialLearners(donorID, donationID, country) {
  // Grab the donation object we're migrating learners to
  const donorRef = getDonation(donorID, donationID);
  // the user pool we'll be pulling learners from
  const poolRef = admin.firestore().collection('user_pool')
      .where('country', '==', country).where('userStatus', '==', 'unassigned')
      .get().then((snapshot)=>{
        return snapshot;
      }).catch((err)=>{
        console.error(err);
      });
  // data from the base campaign object such as cost/learner
  const campaignRef = admin.firestore().collection('campaigns')
      .where('country', '==', country).get().then((snapshot)=>{
        if (snapshot.empty) {
          throw new Error('Missing Campaign Document for ID: ', country);
        }
        let docData = snapshot.docs[0].data();
        let docId = snapshot.docs[0].id;
        return {id: docId, data: docData};
      }).catch((err)=>{
        console.error(err);
      });

  return Promise.all([donorRef, poolRef, campaignRef]).then((vals)=>{
    if (vals[1].empty) {
      console.warn('No free users for campaign: ', vals[0].data.campaignID);
      return new Promise((resolve)=>{
        resolve('resolved');
      });
    }
    const amount = vals[0].data.amount;
    const costPerLearner = vals[2].data.costPerLearner;
    const cap = calculateUserCount(amount, 0, costPerLearner);
    console.log('cap is: ', cap);
    return batchWriteLearners(vals[1], vals[0], cap);
  }).catch((err)=>{
    console.error(err);
  });
}

// special assignment case that matches learners from any country
function assignAnyLearner(donorID, donationID) {
  const donorRef = getDonation(donorID, donationID);
  const poolRef = admin.firestore().collection('user_pool').get()
      .then((snapshot)=>{
        return snapshot;
      }).catch((err)=>{
        console.error(err);
      });
  const campaignRef = admin.firestore().collection('campaigns').get()
      .then((snapshot)=>{
        return snapshot;
      }).catch((err)=>{
        console.error(err);
      });
  return Promise.all([donorRef, poolRef, campaignRef]).then((vals)=>{
    if (vals[1].empty) {
      console.warn('No users available');
      return new Promise((resolve) => {
        resolve('resolved');
      });
    }
    if (vals[2].empty) {
      console.warn('no campaigns available');
      return new Promise((reject)=>{
        reject(new Error('no available campaigns'));
      });
    }
    console.log('adding learners to donation ',
        vals[0].id,
        ' from donor ',
        vals[0].data.sourceDonor);
    const amount = vals[0].data.amount;
    const costPerLearner = DEFAULTCPL;
    const learnerCount = calculateUserCount(amount, 0, costPerLearner);
    return batchWriteLearners(vals[1], vals[0], learnerCount);
  }).catch((err)=>{
    console.error(err);
  });
}

async function assignLearnersByContinent(donorID, donationID, continent) {
  const donorRef = getDonation(donorID, donationID)
  const poolRef = admin.firestore().collection('user_pool')
      .where('continent', '==', continent).get().then((snapshot)=>{
        return snapshot;
      }).catch((err)=>{
        console.error(err);
      });
  const campaignRef = admin.firestore().collection('campaigns')
      .where('country', '==', continent).limit(1).get().then((snapshot)=>{
        if (snapshot.empty) {
          throw new Error('No campaign found for ', continent);
        }
        return snapshot.docs[0];
      }).catch((err)=>{
        console.error(err);
      });
  return Promise.all([donorRef, poolRef, campaignRef]).then((vals)=>{
    if (vals[1].empty) {
      return new Promise((resolve)=>{
        resolve('no users to assign');
      });
    }
    const amount = vals[0].data.amount;
    const costPerLearner = vals[2].data.costPerLearner;
    const cap = calculateUserCount(amount, poolSize, costPerLearner);
    return batchWriteLearners(vals[1], 0, cap);
  });
}

// add learners with country and region data to the front of the queue
function prioritizeLearnerQueue(queue) {
  if (queue.empty) {
    return queue.docs;
  }
  let prioritizedQueue = [];
  queue.forEach((doc)=>{
    let data = doc.data();
    if (data.region !== 'no-region') {
      prioritizedQueue.unshift(doc);
    } else {
      prioritizedQueue.push(doc);
    }
  });
  return prioritizedQueue;
}

// algorithm to calculate how many learners to assign to a donation
function calculateUserCount(amount, learnerCount, costPerLearner) {
  const DONATIONFILLTIMELINE = 7; // minimum days to fill a donation
  const learnerMax = Math.round(amount/costPerLearner);
  const maxDailyIncrease = Math.round(learnerMax/DONATIONFILLTIMELINE);
  return learnerCount + maxDailyIncrease;
}

// collect learner re-assign operations in batches
// each batch is less than the size of the consecutive document edit limit
function batchWriteLearners(snapshot, donation, learnerCount) {
  const batchMax = 495;
  let batchSize = 0;
  let batchCount = 0;
  let batches = [];
  const donorID = donation.data.sourceDonor;
  console.log('donor is: ', donorID, ', donation is: ', donation.id);
  const donationRef = admin.firestore().collection('donor_master').doc(donorID)
      .collection('donations').doc(donation.id);
  const poolRef = admin.firestore().collection('user_pool');
  batches[batchCount] = admin.firestore().batch();
  snapshot.docs = prioritizeLearnerQueue(snapshot);
  console.log('pool of size: ', snapshot.size);
  for (let i=0; i < learnerCount; i++) {
    if (i >= snapshot.size) break;
    if (batchSize >= batchMax) { // time to start a new batch
      batchSize = 0;
      batchCount++;
      batches[batchCount] = admin.firestore().batch();
    }
    let learnerID = snapshot.docs[i].id;
    let data = snapshot.docs[i].data();
    data.sourceDonor = donorID;
    data['sourceDonation'] = donation.id;
    data.userStatus = 'assigned';
    data['assignedOn'] = admin.firestore.Timestamp.now();
    batches[batchCount].set(poolRef.doc(learnerID), data, {merge: true});
    batchSize++;
  }
  writeBatches(batches);
}

// write an array of batches at a rate of 1 batch/second to prevent
// exceeding the write limit
function writeBatches(batches) {
  for (let i=0; i < batches.length; i++) {
    delayOneSecond(()=>{
      console.log('committing batch ', i);
      batches[i].commit();
    });
  }
  return 'Success!';
}
function delayOneSecond(callback) {
  setTimeout(callback, 1050);
}

exports.forceUpdateAggregates = functions.https.onRequest(async (req, res) =>{
  let dbRef = admin.firestore().collection('loc_ref');
  dbRef.get().then((snapshot)=>{
    let countries = [];
    snapshot.forEach((doc)=>{
      const regions = doc.data().regions;
      const country = doc.data().country;
      let learnerCounts = [];
      let countrySum = 0;
      regions.forEach((region)=>{
        if (region.hasOwnProperty('learnerCount') && region.learnerCount >=0) {
          learnerCounts.push({region: region.region,
            learnerCount: region.learnerCount
          });
          countrySum += region.learnerCount;
        }
      });
      countries.push({
        country: country,
        learnerCount: countrySum,
        regions: learnerCounts
      });
    });
    return admin.firestore().collection('aggregate_data').doc('RegionSummary')
        .update({
          countries: countries
        }, {merge: false});
  }).then((result)=>{
    res.json({result: 'updated region aggregates for all countries'});
    return 'resolved';
  }).catch((err)=>{
    console.error(err);
    const errString = 'failed to update, encountered error: ' + err;
    res.json({result: errString});
  });
});

exports.checkForDonationEndDate = functions.firestore
    .document('/donor_master/{donorId}/donations/{documentId}')
    .onUpdate((change, context) =>{
      if (change.after.data().percentFilled >= 100) {
        let data = change.after.data();
        if (!data.hasOwnProperty('endDate')) {
          return admin.firestore().collection('donor_master')
              .doc(context.params.donorId).collection('donations')
              .doc(context.params.documentId).set({
                endDate: admin.firestore.Timestamp.now(),
              }, {merge: true}).then(()=>{
                return 'resolved';
              });
        }
        return new Promise((resolve)=>{
          resolve('resolved');
        });
      }
    });

// If a user is added to a country with a disabled campaign, re-enable it
exports.enableCampaign = functions.firestore.document('/user_pool/{docID}').
    onCreate((snap, context)=>{
      let data = snap.data();
      if (data === undefined || data.country === undefined) {
        return;
      }
      return admin.firestore().collection('campaigns')
          .where('country', '==', data.country)
          .where('isActive', '==', true)
          .where('isVisible', '==', false)
          .limit(1).get().then((snap)=>{
            if (snap.empty) {
              return new Promise((resolve)=>{
                resolve('no disabled campaigns');
              });
            } else {
              let id = snap.docs[0].id;
              return admin.firestore().collection('campaigns').doc(id).update({
                isVisible: true,
              });
            }
          }).catch((err)=>{
            console.error(err);
          });
    });

// if the last user for a country is removed from the pool, disable that
// country in the database
exports.disableCampaign = functions.firestore.document('/user_pool/{docID}')
    .onDelete((snap, context)=>{
      let data = snap.data();
      let pool = admin.firestore().collection('user_pool')
          .where('country', '==', data.country).get().then((snapshot)=>{
            return snapshot;
          }).catch((err)=>{
            console.error(err);
          });
      let campaigns = admin.firestore().collection('campaigns')
          .where('country', '==', data.country).limit(1).get().then((snap)=>{
            return snap;
          }).catch((err)=>{
            console.error(err);
          });
      return Promise.all([pool, campaigns]).then((vals)=>{
        if (vals[1].empty) { // return early if no matching campaigns exist
          return new Promise((resolve) =>{
            resolve('no associated campaign');
          });
        }
        if (vals[0].empty) { // if no learners, disable the campaign
          let doc = vals[1].docs[0];
          return admin.firestore().collection('campaigns').doc(doc.id)
              .update({isVisible: false});
        } else {
          return new Promise((resolve)=>{ // no change if learners present
            resolve('found learners');
          });
        }
      }).catch((err)=>{
        console.error(err);
      });
    });

exports.updateRegion = functions.firestore.document('/user_pool/{documentId}')
    .onCreate((snap, context)=>{
      if (snap.data() === undefined) return;
      const country = snap.data().country;
      const region = snap.data().region;
      console.log(country, region);
      if (country === undefined || region === undefined) return;
      let sum = updateCountForRegion(country, region);
      let docRef = admin.firestore().collection('loc_ref').doc(country);
      let docSnapshot = getRegionsForCountry(docRef);
      let regions = [];
      let countrySum = 0;
      Promise.all([sum, docSnapshot]).then((vals) => {
        regions = vals[1].data().regions;
        let foundRegion = false;
        let regionIndex = -1;
        for (let i=0; i < regions.length; i++) {
          if (!regions[i].hasOwnProperty('learnerCount') ||
            typeof regions[i].learnerCount !== 'number' ||
            regions[i].learnerCount < 0) {
            continue; // only add positive numbers to learnerCount
          }
          if (regions[i].region === region) {
            regions[i].learnerCount = vals[0];
            foundRegion = true;
            regionIndex = i;
          }
          countrySum += regions[i].learnerCount;
        }
        return {
          foundRegion: foundRegion,
          regionIndex: regionIndex,
          sum: vals[0],
        };
      }).then((vals) => {
        if (!vals.foundRegion) {
          getPinForAddress(country + ', ' + region).then((markerLoc) => {
            console.log('--------------------- FOUND LOCATION: ' + markerLoc);
            regions.push({
              region: region,
              pin: {
                lat: markerLoc.lat,
                lng: markerLoc.lng,
              },
              learnerCount: vals.sum,
              streetViews: {
                headingValues: [0],
                locations: [
                ],
              },
            });
            countrySum += vals.sum;

            docRef.set({
              regions: regions,
              learnerCount: countrySum,
            }, {merge: true});

            return;
          }).catch((err) => {
            console.error(err);
          });
        } else if (vals.foundRegion && vals.regionIndex !== -1) {
          if (!regions[vals.regionIndex].hasOwnProperty('pin') ||
            (regions[vals.regionIndex]['pin'].lat === 0 &&
            region[vals.regionIndex]['pin'].lng === 0)) {
            getPinForAddress(country + ', ' + region).then((markerLoc) => {
              regions[vals.regionIndex]['pin'] = {
                lat: markerLoc.lat,
                lng: markerLoc.lng,
              };

              countrySum += vals.sum;

              // Update the loc_ref country regions with new data
              docRef.set({
                regions: regions,
                learnerCount: countrySum,
              }, {merge: true});

              return;
            }).catch((err) => {
              console.error(err);
            });
          }
        }
        return null;
      }).catch((err) => {
        console.error(err);
      });
    });

function getPinForAddress(address) {
  let markerLoc = {lat: 0, lng: 0};
  return gmaps.geocode({
    params: {
      address: address,
      key: 'AIzaSyDEl20cTMsc72W_TasuK5PlWYIgMrzyuAU',
    },
    timeout: 1000,
  }).then((r) => {
    if (r.data.results[0]) {
      markerLoc = r.data.results[0].geometry.location;
    }
    return markerLoc;
  }).catch((e) => {
    console.log(e.response.data.error_message);
  });
}

function getRegionsForCountry(docRef) {
  return docRef.get();
}

exports.addCountryToSummary = functions.firestore
    .document('loc_ref/{documentId}')
    .onCreate((snap, context)=>{
      const country = snap.data().country;
      let regions = snap.data().regions;
      let regionCounts = [];
      let countrySum = 0;
      regions.forEach((region)=>{
        if (region.hasOwnProperty('learnerCount') && region.learnerCount >=0) {
          regionCounts.push({
            region: region.region,
            learnerCount: region.learnerCount,
          });
          countrySum += region.learnerCount;
        }
      });
      let summary = admin.firestore().collection('aggregate_data')
          .doc('RegionSummary');
      return summary.get().then((doc)=>{
        let countries = doc.data().countries;
        countries.push({
          country: country,
          learnerCount: countrySum,
          regions: regionCounts,
        });
        return countries;
      }).then((countries)=>{
        return summary.update({countries: countries});
      }).catch((err)=>{
        console.error(err);
      });
    });

exports.updateSummary = functions.firestore.document('/loc_ref/{documentId}')
    .onUpdate(async (change, context)=>{
      const before = change.before.data();
      const after = change.after.data();
      if (before.learnerCount === after.learnerCount) return;
      const country = change.after.id;
      const originalValue = change.after.data().regions;
      await admin.firestore().collection('aggregate_data')
          .doc('RegionSummary').get().then((summary)=>{
            let sums = summary.data().countries;
            let countryIndex = findObjWithProperty(sums, 'country', country);
            console.log('country index is ' + countryIndex);
            if (countryIndex === undefined){
              sums.push({country: country, learnerCount: 0, regions: []});
              countryIndex = sums.length - 1;
            }
            let countrySum = 0;
            let regionCounts = [];
            originalValue.forEach((region)=>{
              if (region.hasOwnProperty('learnerCount') &&
              region.learnerCount >= 0) {
                regionCounts.push({
                  region: region.region,
                  learnerCount: region.learnerCount,
                });
                countrySum += region.learnerCount;
              }
            });
            sums[countryIndex].regions = regionCounts;
            sums[countryIndex]['learnerCount'] = countrySum;
            admin.firestore().collection('loc_ref').doc(country).update({
              learnerCount: sums[countryIndex].learnerCount
            });
            return admin.firestore().collection('aggregate_data')
                .doc('RegionSummary')
                .update({countries: sums}, {merge: true});
          }).catch((err)=>{
            console.error(err);
          });
    });

exports.updateDonationLearnerCount = functions.firestore
    .document('/user_pool/{documentId}')
    .onWrite((change, context)=>{
      const before = change.before.data();
      const after = change.after.data();
      if (before.userStatus === 'unassigned'&&
          after.userStatus === 'assigned') {
        console.log('assigning');
        const donor = after.sourceDonor;
        const donation = after.sourceDonation;
        return updateLocationBreakdownForDonation(donor, donation);
      }
      return;
    });

exports.updateMasterLearnerCount = functions.firestore
    .document('/user_pool/{userId}').onCreate((snap, context)=>{
      const msgRef = admin.firestore().collection('aggregate_data').doc('data');
      return admin.firestore().collection('user_pool').get().then((snapshot)=>{
        const total = snapshot.size;
        let dntSum = 0;
        snapshot.forEach((doc)=>{
          if (doc.data().country === 'no-country') {
            dntSum++;
          }
        });
        return {allLearnersCount: total, allLearnersWithDoNotTrack: dntSum};
      }).then((data)=>{
        return msgRef.set(data, {merge: true}).catch((err)=>{
          console.error(err);
        });
      }).catch((err)=>{
        console.error(err);
      });
    });

exports.updateAggregateData = functions.firestore
    .document('/loc_ref/{documentID}').onUpdate((change, context)=>{
      const before = change.before.data();
      const after = change.after.data();
      if (change.after.learnerCount !== before.learnerCount) {
        const sumRef = admin.firestore()
            .collection('aggregate_data').doc('data');
        return admin.firestore().collection('loc_ref').get().then((snap)=>{
          let sum = 0;
          let dntSum = 0;
          snap.forEach((doc)=>{
            sum += doc.data().learnerCount;
            if (doc.data().country === 'no-country') {
              dntSum += doc.data().learnerCount;
            }
          });
          return {sum: sum, noCountry: dntSum};
        }).catch((err)=>{
          console.error(err);
        });
      }
      return new Promise((resolve)=>{
        resolve('no change in learner count');
      });
    });

exports.updateCampaignLearnerCount = functions.firestore
    .document('donor_master/{donorId}/donations/{donationId}')
    .onUpdate((change, context)=>{
      const before = change.before.data();
      const after = change.after.data();
      if (before.learnerCount === after.learnerCount) {
        return 0;
      }
      const campaignId = change.after.data().campaignID;
      updatePercentFilled(change.after, context);
      return updateCountForCampaign(campaignId);
    });

exports.addNewLearnersToCampaign = functions.firestore
    .document('user_pool/{documentId}')
    .onCreate((snap, context)=>{
      if (snap.data() === undefined) return;
      let campaignID = snap.data().sourceCampaign;
      if (campaignID === undefined) return;
      updateCountForCampaign(campaignID);
    });

exports.onDonationIncrease = functions.firestore
    .document('donor_master/{uid}/donations/{donationId}')
    .onUpdate((change, context)=>{
      const before = change.before.data();
      const after = change.after.data();
      if (before.amount !== after.amount || !after.percentFilled) {
        return updatePercentFilled(change.after, context);
      }
      return new Promise((resolve)=>{
        resolve('resolved');
      });
    });

exports.reEnableMonthlyDonation = functions.firestore
    .document('donor_master/{uid}/donations/{donationId}')
    .onUpdate((change, context)=>{
      const before = change.before.data();
      const after = change.after.data();
      // learnerCount never decreases so a drop in percentFilled
      // means an increase in the total donation amount
      if (before.percentFilled > after.percentFilled) {
        // removing the end date is the final step to allowing a monthly
        // donation to receive users again.
        after.ref.update({endDate: admin.firestore.FieldValue.delete()});
      }
    });

function updatePercentFilled(snap, context) {
  let data = snap.data();
  const docRef = admin.firestore().collection('donor_master')
      .doc(data.sourceDonor)
      .collection('donations').doc(context.params.donationId);
  return admin.firestore().collection('campaigns')
      .where('campaignID', '==', data.campaignID).get().then((snap)=>{
        if (snap.empty) {
          throw new Error('missing campaign document for ', data.campaignID);
        }
        return snap.docs[0].data().costPerLearner;
      }).then((costPerLearner)=>{
        const amount = data.amount;
        const learnerCount = data.learnerCount;
        return (learnerCount/Math.round(amount / costPerLearner))*100;
      }).then((percent)=>{
        return docRef.set({
          percentFilled: Math.round(percent),
        }, {merge: true});
      }).catch((err)=>{
        console.error(err);
      });
}

function updateLocationBreakdownForDonation(donorID, donationID) {
  console.log('sourceDonation is ', donationID);
  const donationRef = admin.firestore().collection('donor_master')
      .doc(donorID).collection('donations').doc(donationID);
  const poolRef = admin.firestore().collection('user_pool')
      .where('sourceDonation', '==', donationID)
      .where('sourceDonor', '==', donorID);
  return poolRef.get().then((snap)=>{
    if (snap.empty) return {learners: 0, countries: []};
    let countries = [];
    snap.forEach((doc)=>{
      let data = doc.data();
      let index = findObjWithProperty(countries, 'country', data.country)
      if (index ===undefined) {
        countries.push({country: data.country, learnerCount: 1, regions: []});
      } else {
        countries[index].learnerCount++;
      }
      let regions = countries[index].regions;
      let regIndex = findObjWithProperty(regions, 'region', data.region);
      if (regIndex === undefined) {
        countries[index].regions.push({region: data.region, learnerCount: 1});
      } else {
        countries[index].regions[regIndex].learnerCount++;
      }
    });
    return {learners: snap.size, countries: countries};
  }).then((res)=>{
    return donationRef.update({learnerCount: res.learners,
      countries: res.countries}
    );
  }).catch((err)=>{
    console.error(err);
  })
}


async function updateCountForCampaign(campaignID) {
  let dbRef = admin.firestore().collection('campaigns');
  const id = dbRef.where('campaignID', '==', campaignID).get()
      .then((snapshot)=> {
        if (snapshot.empty) {
          return undefined;
        }
        return snapshot.docs[0];
      }).then((doc)=>{
        if (doc === undefined) {
          return '';
        }
        return doc.id;
      }).catch((err)=>{
        console.error(err);
      });
  const poolSums = admin.firestore().collection('user_pool')
      .where('sourceCampaign', '==', campaignID)
      .get().then((snapshot)=>{
        return snapshot.size;
      }).catch((err)=>{
        console.error(err);
      });
  Promise.all([id, poolSums]).then((vals)=>{
    if (vals[0] !== '') {
      let sum = 0;
      if (!isNaN(vals[1])) {
        sum = vals[1];
      }
      admin.firestore().collection('campaigns').doc(vals[0]).update({
        learnerCount: sum,
      }, {merge: true});
    }
    return;
  }).catch((err)=>{
    console.error(err);
  });
}

function updateCountForRegion(country, region) {
  console.log(country, region);
  if (country === undefined) {
    return new Promise((resolve)=>{
      resolve('resolved');
    });
  }
  if (region === undefined) {
    region = 'no-region';
  }
  return admin.firestore().collection('user_pool')
      .where('country', '==', country).where('region', '==', region)
      .get().then((snapshot)=>{
        return snapshot.size;
      }).catch((err) => {
        console.error(err);
      });
}

function findObjWithProperty(arr, prop, val) {
  for (let i=0; i < arr.length; i++) {
    if (arr[i].hasOwnProperty(prop) && arr[i][prop] === val) {
      return i;
    }
  }
  return undefined;
}
