const functions = require('firebase-functions');

const admin = require('firebase-admin');

admin.initializeApp();

const DEFAULTCPL = 0.25;

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
        }).catch((err)=>{console.error(err);});
        i++;
      });
      data.learnerCount = countrySum;
      batches[batchCount].set(locRef.doc(id), data, {merge:true});
      batchSize++;
    });
    for (let i=0; i < batches.length; i++) {
      setTimeout((batch, i) =>{
        batch.commit().then(()=>{
          console.log('committed batch ', i);
          return;
        }).catch((err)=>{console.error(err);
        });
      },1050, batches[i], i);
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
    if (snapshot.empty) {return;}
    snapshot.forEach((doc)=>{
      if(batchSize >= batchMax) {
        batchSize = 0;
        batchCount++
        batches[batchCount] = admin.firestore().batch();
      }
      let id = doc.id;
      batches[batchCount].delete(poolRef.doc(id));
      batchSize++;
    });
    for(let i=0; i < batches.length; i++) {
      setTimeout((batch) =>{
        batch.commit();
      }, 1050, batches[i]);
    }
    return;
  }).catch((err)=>{console.error(err);});
  res.json({status: 200, message: 'cleared user pool'}).end();
});

exports.logDonation = functions.https.onRequest(async (req, res) =>{
  let splitString = req.body.campaignID.split('|');
  let params = {
    firstName: req.body.firstName,
    lastName: req.body.lastName,
    email: req.body.email,
    timestamp: admin.firestore.Firestore.Timestamp.now(),
    amount: Number(req.body.amount),
    frequency: req.body.frequency,
    campaignID: splitString[0],
    country: splitString[1],
  };
  writeDonation(params).then((result)=>{
    res.status(200).send(result);
    return;
  }).catch(err=>{
    console.error(err);
    res.status(500).send(err);
  });
});

function writeDonation (params)
{
  const dbRef =  admin.firestore().collection('donor_master');
  let donorID ="";
  return getDonorID(params.email).then((foundID)=>{
    if (foundID === '') {
      return dbRef.add({
        firstName: params.firstName,
        lastName: params.lastName,
        email: params.email,
        dateCreated: params.timestamp,
      }).then((docRef)=>{
        dbRef.doc(docRef.id).set({donorID: docRef.id},{merge:true});
        return docRef.id;
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
      if (params.country === 'any') {
        return assignAnyLearner(donorID);
      }
      return assignInitialLearners(donorID, params.country);
    }).catch((err)=>{
      console.error(err);
    });
  }).catch((err) =>{
    console.error(err);
    return err;
  });
}

function getCostPerLearner(campaignID) {
  return admin.firestore().collection('campaigns').where('campaignID', '==', campaignID)
      .get().then((snap)=>{
        if (snap.empty) {
          throw new Error("can't find campaign with ID: ", campaignID);
        }
        return snap.docs[0].data().costPerLearner;
      }).catch((err)=>{
        console.error(err);
      });
}

function getDonorID(email) {
  const dbRef = admin.firestore().collection('donor_master');
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


// Grab initial list of learners at donation time from user_pool
// and assign to donor according to donation amount and campaigns cost/learner
function assignInitialLearners(donorID, country) {
  // Grab the donation object we're migrating learners to
  const donorRef = admin.firestore().collection('donor_master').doc(donorID)
      .collection('donations').where('country', '==', country)
      .orderBy('startDate', 'desc').get()
      .then((snapshot)=>{
        if (snapshot.size === 0) {
          throw new Error(donorID, ' is missing Donation Document for: ', country);
        }
        const docID = snapshot.docs[0].id;
        const data = snapshot.docs[0].data();
        return {id: docID, data: data};
      }).catch((err)=>{
        console.error(err);
      });
  // the user pool we'll be pulling learners from
  const poolRef = admin.firestore().collection('user_pool')
      .where('country', '==', country).get().then((snapshot)=>{
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
    const poolSize = vals[1].size;
    const costPerLearner = vals[2].data.costPerLearner;
    const learnerCount = calculateUserCount(amount, poolSize, costPerLearner);
    return batchWriteLearners(vals[1], vals[0], learnerCount);
  }).catch((err)=>{
    console.error(err);
  });
}

// special assignment case that matches learners from any country
function assignAnyLearner(donorID) {
  const donorRef = admin.firestore().collection('donor_master').doc(donorID)
      .collection('donations').where('country', '==', 'any')
      .orderBy('startDate', 'desc').get()
      .then((snapshot)=>{
        if (snapshot.empty) {
          throw new Error(donorID, ' is missing Donation Document for any country');
        }
        const docID = snapshot.docs[0].id;
        const data = snapshot.docs[0].data();
        return {id: docID, data: data};
      }).catch((err)=>{
        console.error(err);
      });

  const poolRef = admin.firestore().collection('user_pool').get()
      .then((snapshot)=>{
        return snapshot
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
    console.log('adding learners to donation ', vals[0].id, ' from donor ', vals[0].data.sourceDonor);
    const amount = vals[0].data.amount;
    const poolSize = vals[1].size;
    const costPerLearner = DEFAULTCPL;
    const learnerCount = calculateUserCount(amount, poolSize, costPerLearner);
    return batchWriteLearners(vals[1], vals[0], learnerCount);
  }).catch((err)=>{
    console.error(err);
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

//algorithm to calculate how many learners to assign to a donation
function calculateUserCount (amount, poolSize, costPerLearner) {
  const threshold = 0.05;
  let count = 1;
  if (costPerLearner >= amount) {
    return count;
  }
  if(poolSize * threshold > 1) {
    count = Math.round(poolSize * threshold);
    if(count > Math.round(amount/costPerLearner)) { //upper bound determined by cost
      count = Math.round(amount/costPerLearner);
    }
  }
  return count;
}
// collect learner re-assign operations in batches
// each batch is less than the size of the consecutive document edit limit
function batchWriteLearners(snapshot, donation, learnerCount) {
  const batchMax = 495;
  let batchSize = 0;
  let batchCount = 0;
  let batches = [];
  const donorID = donation.data.sourceDonor;
  const donationRef = admin.firestore().collection('donor_master').doc(donorID)
    .collection('donations').doc(donation.id);
  const poolRef = admin.firestore().collection('user_pool');
  batches[batchCount] = admin.firestore().batch();
  snapshot.docs = prioritizeLearnerQueue(snapshot);
  for(let i=0; i < learnerCount; i++) {
    if(i >= snapshot.size) {break;}
    if(batchSize >= batchMax) { //time to start a new batch
      batchSize = 0;
      batchCount++;
      batches[batchCount] = admin.firestore().batch();
    }
    let learnerID = snapshot.docs[i].id;
    let data = snapshot.docs[i].data();
    data.sourceDonor = donorID;
    const newRef = donationRef.collection('users').doc(learnerID);
    batches[batchCount].set(newRef, data);
    batches[batchCount].delete(poolRef.doc(learnerID)); //avoid multiple documents per learner
    batchSize += 2;
  }
  return writeBatches(batches);
}

 // write an array of batches at a rate of 1 batch/second to prevent
 // exceeding the write limit
 function writeBatches(batches) {
  for (let i=0; i < batches.length; i++)
  {
    delayOneSecond(()=>{
      console.log("committing batch ", i);
      batches[i].commit();
    });
  }
  return "Success!";
}
function delayOneSecond (callback) {
  setTimeout(callback, 1050);
}

exports.forceUpdateAggregates = functions.https.onRequest(async (req, res) =>{
  let dbRef = admin.firestore().collection('loc_ref');
  dbRef.get().then(snapshot=>{
    let countries = [];
    snapshot.forEach(doc=>{
      const regions = doc.data().regions;
      const country = doc.data().country;
      let learnerCounts = [];
      let countrySum = 0;
      regions.forEach((region)=>{
        if(region.hasOwnProperty("learnerCount") && region.learnerCount >=0){
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
  }).catch(err=>{
    console.error(err);
    res.json({result:'failed to update, encountered error: ${err}'});
  });
});

exports.checkForDonationEndDate = functions.firestore
    .document('/donor_master/{donorId}/donations/{documentId}')
    .onUpdate((change, context) =>{
      if(change.after.data().percentFilled >= 100) {
        let data = change.after.data();
        if (!data.hasOwnProperty('endDate')) {
          return admin.firestore().collection('donor_master')
              .doc(context.params.donorId).collection('donations')
              .doc(context.params.documentId).set({
                endDate: admin.firestore.Timestamp.now(),
              }, {merge: true}).then(()=>{return 'resolved';});
        }
        return new Promise((resolve)=>{resolve('resolved');})
      }
    });

// If a user is added to a country with a disabled campaign, re-enable it
exports.enableCampaign = functions.firestore.document('/user_pool/{docID}').
    onCreate((snap, context)=>{
      let data = snap.data();
      return admin.firestore().collection('campaigns')
          .where('country', '==', data.country).where('isActive', '==', false)
          .limit(1).get().then((snap)=>{
            if (snap.empty) {
              return new Promise((resolve)=>{
                resolve('no disabled campaigns');
              });
            } else {
              let id = snap.docs[0].id;
              return admin.firestore().collection('campaigns').doc(id).update({
                isActive: true
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
              .update({isActive: false});
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
    const country = snap.data().country;
    const region = snap.data().region;
    console.log(country, region);
    return updateCountForRegion(country, region).then(sum=>{
      let docRef = admin.firestore().collection('loc_ref').doc(country);
      return docRef.get().then(doc=>{
        let regions = doc.data().regions;
        let countrySum = 0;
        let foundRegion = false;
        for (let i=0; i < regions.length; i++){
          if (!regions[i].hasOwnProperty('learnerCount') ||
            typeof regions[i].learnerCount !== 'number' ||
            regions[i].learnerCount < 0){
            continue; //only add positive numbers to learnerCount
          }
          if(regions[i].region === region){
            regions[i].learnerCount = sum;
            foundRegion = true;
          }
          countrySum += regions[i].learnerCount;
        }
        if (!foundRegion) {
          regions.push({
            region: region,
            pin: {
              lat: 0,
              lng: 0,
            },
            learnerCount: sum,
            streetViews: {
              headingValue: [0],
              locations: [
              ],
            },
          });
          countrySum += sum;
        }
        return {regions: regions, countrySum: countrySum};
      }).then(values=>{
        return docRef.set({
          regions: values.regions,
          learnerCount: values.countrySum
        }, {merge: true});
      }).catch(err=>{console.error(err);});
    }).catch(err=>{console.error(err);});
  });

exports.addCountryToSummary = functions.firestore.document('loc_ref/{documentId}')
  .onCreate((snap, context)=>{
    const country = snap.data().country;
    let regions = snap.data().regions;
    let regionCounts = [];
    let countrySum = 0;
    regions.forEach(region=>{
      if(region.hasOwnProperty('learnerCount') && region.learnerCount >=0){
        regionCounts.push({
          region: region.region,
          learnerCount: region.learnerCount
        });
        countrySum += region.learnerCount;
      }
    });
    let summary = admin.firestore().collection('aggregate_data').doc('RegionSummary');
    return summary.get().then(doc=>{
      let countries = doc.data().countries;
      countries.push({
        country: country,
        learnerCount: countrySum,
        regions: regionCounts
      });
      return countries;
    }).then(countries=>{
      return summary.update({countries: countries});
    }).catch(err=>{console.error(err);});
  });

exports.updateSummary = functions.firestore.document('/loc_ref/{documentId}')
  .onUpdate(async (change, context)=>{
    if (change.before.data().learnerCount === change.after.data().learnerCount) {return;}
    const country = change.after.id;
    const originalValue = change.after.data().regions;
    let summary = await admin.firestore().collection('aggregate_data').doc('RegionSummary').get().catch(err=>{console.error(err);});
    let sums = summary.data().countries;
    let countryIndex = findObjWithProperty(sums, "country", country);
    console.log('country index is ' + countryIndex);
    if(countryIndex === undefined){
      sums.push({country: country, learnerCount: 0, regions: []});
      countryIndex = sums.length - 1;
    }
    let countrySum = 0;
    let regionCounts = []
    originalValue.forEach((region)=>{
      if(region.hasOwnProperty('learnerCount') && region.learnerCount >= 0){
        regionCounts.push({region: region.region, learnerCount: region.learnerCount});
        countrySum += region.learnerCount;
      }
    });
    sums[countryIndex].regions = regionCounts;
    sums[countryIndex]['learnerCount'] = countrySum;
    admin.firestore().collection('loc_ref').doc(country).update({
      learnerCount: sums[countryIndex].learnerCount
    });
    return admin.firestore().collection('aggregate_data').doc('RegionSummary').update({countries: sums}, {merge: true});
  });

  exports.updateDonationLearnerCount = functions.firestore
    .document('donor_master/{donorId}/donations/{donationId}/users/{documentId}')
    .onCreate((snap, context)=>{
      console.log('found new user: ' + snap.id);
      updateLocationBreakdownForDonation(context);
    });

  exports.updateAggregateData = functions.firestore
    .document('aggregate_data/RegionSummary').onUpdate((change, context)=>{
      const sumRef = admin.firestore().collection('aggregate_data').doc('data');
      const data = change.after.data();
      let sum = 0;
      let noCountry =0;
      data.countries.forEach((country)=> {
        sum += country.learnerCount;
        if (country.country === 'no-country') {
          noCountry = country.learnerCount;
        }
      });
      sumRef.update({
        allLearnersCount: sum,
        allLearnersWithDoNotTrack: noCountry
      });
    });

    /*exports.registerDeletedLearner = functions.firestore
      .document('donor_master/{donorId}/donations/{donationId}/users/{documentId}')
      .onDelete((snap, context)=>{
        let dbRef = admin.firestore().collection('donor_master')
          .doc(context.params.donorId).collection('donations')
          .doc(context.params.donationId);
        console.log('deleted user: ' + snap.id);
        return dbRef.collection('users').get().then(snapshot=>{
          if(snapshot.empty)
          {
            return 0;
          }
          return snapshot.size;
        }).then(sum=>{
          return dbRef.update({learnerCount: sum},{merge: true});
        }).catch(err=>{console.error(err);});
      });*/

    exports.updateCampaignLearnerCount = functions.firestore
      .document('donor_master/{donorId}/donations/{donationId}')
      .onUpdate((change, context)=>{
        if(change.before.data().learnerCount === change.after.data().learnerCount)
        {
          return 0;
        }
        const campaignId = change.after.data().campaignID;
        updatePercentFilled(change.after, context);
        return updateCountForCampaign(campaignId);
    });

    exports.addNewLearnersToCampaign = functions.firestore
      .document('user_pool/{documentId}')
      .onCreate((snap, context)=>{
        let campaignID = snap.data().sourceCampaign;
        return updateCountForCampaign(campaignID);
      });

  function updatePercentFilled(snap, context) {
    let data = snap.data();
    const docRef = admin.firestore().collection('donor_master')
        .doc(context.params.donorId)
        .collection('donations').doc(context.params.donationId);
    const campaignRef = admin.firestore().collection('campaigns')
        .where('campaignID','==', data.campaignID).get().then((snap)=>{
          if(snap.empty) {
            throw new Error("missing campaign document for ", data.campaignID);
          }
          return snap.docs[0].data().costPerLearner;
        }).then((costPerLearner)=>{
          const amount = data.amount;
          const learnerCount = data.learnerCount;
          return (learnerCount/Math.round(amount / costPerLearner))*100;
        }).then((percent)=>{
            return docRef.set({percentFilled: percent},{merge: true});
        }).catch((err)=>{
          console.error(err);
        });
  }

  function updateLocationBreakdownForDonation (context) {
    let dbRef = admin.firestore().collection('donor_master')
      .doc(context.params.donorId).collection('donations')
      .doc(context.params.donationId);
    return dbRef.collection('users').get().then(snapshot=>{
      if(snapshot.empty)
      {
        return {learnerCount: 0, countries: []};
      }
      let countries = [];
      snapshot.forEach((doc)=>{
        let data = doc.data();
        let countryIndex = findObjWithProperty(countries, "country", data.country);
        if(countryIndex === undefined)
        {
          countries.push({
            country: data.country,
            learnerCount: 1,
            regions: [],
          });
          countryIndex = countries.length -1;
        }
        else{
          countries[countryIndex].learnerCount++;
        }
        let regionIndex = findObjWithProperty(countries[countryIndex].regions, "region", data.region);
        if(regionIndex === undefined) {
          countries[countryIndex].regions.push({
            region: data.region,
            learnerCount: 1,
          });
        } else {
          countries[countryIndex].regions[regionIndex].learnerCount++;
        }
      });
      return {learnerCount: snapshot.size, countries: countries};
    }).then(res=>{
      return dbRef.update({learnerCount: res.learnerCount, countries: res.countries},{merge: true});
    }).catch(err=>{console.error(err);});
  }


  async function updateCountForCampaign(campaignID)
  {
    let dbRef = admin.firestore().collection('campaigns');
    const id = dbRef.where('campaignID', '==', campaignID).get()
      .then((snapshot)=> {
        if(snapshot.empty){
          return undefined;
        }
        return snapshot.docs[0];
      }).then((doc)=>{
        if(doc === undefined){
          return '';
        }
        return doc.id;
      }).catch((err)=>{console.error(err);});
    const donationSums = admin.firestore().collectionGroup('donations')
        .where('campaignID','==', campaignID).get().then(snapshot=>{
          let sum = 0
          if(snapshot.empty){
            sum = 0;
          }
          else{
            snapshot.forEach(doc=>{
              if(doc.data().learnerCount !== undefined){
                sum += doc.data().learnerCount;
              }
            });
          }
          return sum;
        }).catch(err=>{console.error(err);});
    const poolSums = admin.firestore().collection('user_pool')
        .where('sourceCampaign', '==', campaignID)
        .get().then(snapshot=>{
          return snapshot.size;
        }).catch(err=>{console.error(err);});
    const unassignedSums = admin.firestore().collection('unassigned_users')
        .where('sourceCampaign', '==', campaignID)
        .get().then(snapshot=>{
          return snapshot.size
        }).catch(err=>{console.error(err);});
    Promise.all([id, donationSums, poolSums, unassignedSums]).then((vals)=>{
      if(vals[0] !== ''){
        let sum = 0;
        for (let i=1; i < vals.length; i++) {
          if(!isNaN(vals[i])) {
            sum += vals[i];
          }
        }
        admin.firestore().collection('campaigns').doc(vals[0]).update({
          learnerCount: sum
        }, {merge: true});
      }
      return;
    }).catch(err=>{console.error(err);});
  }

  function updateCountForRegion(country, region)
  {
    console.log(country, region);
    if(country === undefined) {return new Promise((resolve)=>{
      resolve('resolved');
    });}
    if(region === undefined){region = 'no-region';}
    let dbRef = admin.firestore().collectionGroup('users');
    const assignedUsers = dbRef.where('country', '==', country)
        .where('region','==',region)
        .get().then(snapshot=>{
          return snapshot.size;
        }).catch((error)=>{
          console.error(err);
        });
    const poolRef = admin.firestore().collection('user_pool')
        .where('country', '==', country).where('region', '==', region)
        .get().then(snapshot=>{
            return snapshot.size;
        }).catch(err => {
          console.error(err);
        });
    const unassignedRef = admin.firestore().collection('unassigned_users')
        .where('country','==',country).where('region','==',region)
        .get().then(snapshot=>{
          return snapshot.size;
        }).catch(err=>{
          console.error(err);
        });
    return Promise.all([assignedUsers, poolRef, unassignedRef]).then((vals)=>{
      let sum = 0;
      vals.forEach((val)=>{
        if(!isNaN(val)) {
          sum += val;
        }
      });
      return sum;
    }).catch((err)=>{
      console.error(err);
    });
  }

  function findObjWithProperty(arr, prop, val) {
    for(let i=0; i < arr.length; i++) {
      if(arr[i].hasOwnProperty(prop) && arr[i][prop] === val) {
        return i;
      }
    }
    return undefined;
  }
