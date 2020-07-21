const functions = require('firebase-functions');

const admin = require('firebase-admin');

admin.initializeApp();




exports.logDonation = functions.https.onRequest(async (req, res) =>{
  let params = {
    firstName: req.body.firstName,
    lastName: req.body.lastName,
    email: req.body.email,
    timestamp: admin.firestore.Firestore.Timestamp.now(),
    amount: req.body.amount,
    campaignID: req.body.campaignID,
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
  return getDonorID(params.email).then((donorID)=>{
    if (donorID === '') {
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
      return donorID;
    }
  }).then((donorID)=>{
    console.log("new id is: " + donorID);
    const dbRef = admin.firestore().collection('donor_master').doc(donorID);
    return dbRef.collection('donations').add({
      campaignID: params.campaignID,
      learnerCount: 0,
      sourceDonor: donorID,
      amount: params.amount,
      countries: [],
      startDate: params.timestamp,
    }).then(()=>{
      return assignInitialLearners(donorID,params.campaignID);
    }).catch((err)=>{console.error(err);});
  }).catch((err) =>{
    console.error(err);
    return err;
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
function assignInitialLearners(donorID, donationID) {
  //Grab the donation object we're migrating learners to
  const donorRef = admin.firestore().collection('donor_master').doc(donorID)
  .collection('donations').where('campaignID', '==', donationID).get()
  .then((snapshot)=>{
    if(snapshot.size === 0) {
      throw new Error(donorID, " is missing Donation Document for: ", donationID);
    }
    const docID = snapshot.docs[0].id;
    const data = snapshot.docs[0].data();
    return {id: docID, data: data};
  }).catch((err)=>{
    console.error(err);
  });
  //the user pool we'll be pulling learners from
  const poolRef = admin.firestore().collection('user_pool')
    .where('sourceCampaign', '==', donationID).get().then((snapshot)=>{
      return snapshot;
    }).catch((err)=>{
      console.error(err);
    });
  //data from the base campaign object such as cost/learner
  const campaignRef = admin.firestore().collection('campaigns')
    .where('campaignID', '==', donationID).get().then((snapshot)=>{
      if(snapshot.empty) {
        throw new Error("Missing Campaign Document for ID: ", donationID);
      }
      let docData = snapshot.docs[0].data();
      let docId = snapshot.docs[0].id;
      return {id: docId, data: docData};
    }).catch((err)=>{
      console.error(err);
    });

    Promise.all([donorRef, poolRef, campaignRef]).then((vals)=>{
      if(vals[1].empty) {
        console.warn("No users available for campaign: ", vals[0].data.campaignID);
        return 1;
      }
      const amount = vals[0].data.amount;
      const poolSize = vals[1].size;
      const costPerLearner = vals[2].data.costPerLearner;
      const learnerCount = calculateUserCount(amount, poolSize, costPerLearner);
      return batchWriteLearners(vals[1], vals[0], learnerCount);
    }).catch((err)=>{console.error(err);});
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
    const newRef = donationRef.collection('users').doc();
    batches[batchCount].set(newRef, data);
    batches[batchCount].delete(poolRef.doc(learnerID)); //avoid multiple documents per learner
  }
  writeBatches(batches);
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
        for (let i=0; i < regions.length; i++){
          if(!regions[i].hasOwnProperty('learnerCount') ||
            typeof regions[i].learnerCount !== 'number' ||
            regions[i].learnerCount < 0){
            continue; //only add positive numbers to learnerCount
          }
          if(regions[i].region === region){
            regions[i].learnerCount = sum;
          }
          countrySum += regions[i].learnerCount;
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
    admin.firestore().collection('loc_ref').doc(country).update({learnerCount: sums[countryIndex].learnerCount});
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

    exports.registerDeletedLearner = functions.firestore
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
      });

    exports.updateCampaignLearnerCount = functions.firestore
      .document('donor_master/{donorId}/donations/{donationId}')
      .onUpdate((change, context)=>{
        if(change.before.data().learnerCount === change.after.data().learnerCount)
        {
          return;
        }
        const campaignId = change.after.data().campaignID;
        return updateCountForCampaign(campaignId);
    });

    exports.addNewLearnersToCampaign = functions.firestore
      .document('user_pool/{documentId}')
      .onCreate((snap, context)=>{
        let campaignID = snap.data().sourceCampaign;
        return updateCountForCampaign(campaignID);
      });



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


  function updateCountForCampaign(campaignID)
  {
    console.log('searching for campaign ', campaignID);
    let id ='';
    let dbRef = admin.firestore().collection('campaigns');
    return dbRef.where('campaignID', '==', campaignID).get().then(snapshot=>{
      if(snapshot.empty){
        return;
      }
      return snapshot.docs[0];
    }).then(doc=>{
      if(doc === undefined){
        return;
      }
      id = doc.id;
      console.log('found campaign with id ' + id);
      return admin.firestore().collectionGroup('donations').where('campaignID','==', campaignID).get().then(snapshot=>{
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
        console.log('sum is: ' + sum);
        return sum;
      }).catch(err=>{console.error(err);});
    }).then(sum=>{
      let poolRef = admin.firestore().collection('user_pool');
      return poolRef.where('sourceCampaign', '==', campaignID)
        .get().then(snapshot=>{
          sum += snapshot.size;
          return sum;
        }).catch(err=>{console.error(err);});
    }).then(sum=>{
      let unassignedRef = admin.firestore().collection('unassigned_users');
      return unassignedRef.where('sourceCampaign', '==', campaignID)
        .get().then(snapshot=>{
          sum += snapshot.size;
          return sum;
        }).catch(err=>{console.error(err);});
    }).then(sum=>{
      if(id !== ''){
        let msgRef = admin.firestore().collection('campaigns').doc(id);
        msgRef.update({learnerCount: sum}, {merge: true});
      }
      return;
    }).catch(err=>{console.error(err);});
  }

  function updateCountForRegion(country, region)
  {
    console.log(country, region);
    if(country === undefined) {return;}
    if(region === undefined){region = 'no-region';}
    let dbRef = admin.firestore().collectionGroup('users');
    return dbRef.where('country', '==', country).where('region','==',region)
      .get().then(snapshot=>{
        return snapshot.size;
      }).then(subtotal=>{
        let poolRef = admin.firestore().collection('user_pool');
        return poolRef.where('country', '==', country).where('region', '==', region)
          .get().then(snapshot=>{
            subtotal += snapshot.size;
            return subtotal;
          }).catch(err => {console.error(err);});
      }).then(subtotal=>{
        let unassignedRef = admin.firestore().collection('unassigned_users');
        return unassignedRef.where('country','==',country).where('region','==',region)
        .get().then(snapshot=>{
          subtotal += snapshot.size;
          return subtotal;
        }).catch(err=>{console.error(err);});
      }).catch(err=>{console.error(err);});
  }

  function findObjWithProperty(arr, prop, val) {
    for(let i=0; i < arr.length; i++) {
      if(arr[i].hasOwnProperty(prop) && arr[i][prop] === val) {
        return i;
      }
    }
    return undefined;
  }
