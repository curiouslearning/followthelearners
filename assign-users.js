const admin = require('firebase-admin');
// const firebase = require('firebase/app');
const serviceAccount = require('./keys/firestore-key.json');
const PRUNEDATE = 7;
const DAYINMS = 86400000;
const CONTINENTS = [
  'Africa',
  'Americas',
  'Antarctica',
  'Asia',
  'Europe',
  'Oceania',
];

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const firestore = admin.firestore();

function main() {
  assignExpiringLearners();
}
main();

async function assignExpiringLearners() {
  let priorityQueue = 0;
  getPriorityQueue().then((queue)=>{
    if (queue === undefined) {
      console.log('failed to create priority queue');
      return 0;
    } // early return for no donations
    priorityQueue = queue;
    return queue.len;
  }).then((len)=>{
    return getLearnerQueue(priorityQueue.length, PRUNEDATE).then((learnerSnap)=>{
      if (learnerSnap === undefined || learnerSnap.empty) {
        console.log('no new learners to assign');
        return;
      }
      console.log('prioritizing snap of size ', learnerSnap.size);
      let learnerQueue = prioritizeLearnerQueue(learnerSnap);
      console.log('learnerQueue length: ', learnerQueue.length);
      console.log('priority queue length:', priorityQueue.length);
      matchLearnersToDonors(learnerQueue, priorityQueue);
      batchLearnerAssignment(priorityQueue);
    }).catch((err)=>{
      console.error(err);
    });
  }).catch((err)=>{
    console.error(err);
  });
}

/**
* assign as many learners as possible to as many matching donations as possible,
* with a minimum of 1 matching learner per donation, and a maximum of 100%
* of that donation's capacity
* capacity determined by donation.amount/donation.costPerLearner
* @param{Object[]} learners the priority stack of learners
* @param{Object[]} donations the priority queue of donations
*/
function matchLearnersToDonors(learners, donations) {
  let fullDonations = 0;
  while ((learners !== undefined)&&(learners.length > 1) &&
        (fullDonations < donations.length)) {
    if (learners[0] === undefined) {
      learners.splice(0, 1);
      continue;
    }
    let foundDonor = false;
    for (let i=0; i < donations.length; i++) {
      let donation = [];
      donation = donations[i];
      let data = [];
      data = learners[0].data();
      if (!checkForMatch(data, donation)) {
        // only assign users to donations from matching campaigns
        continue;
      }
      if (!donation.percentFilled) {
        let denominator = donation.amount/donation.costPerLearner
        donation['percentFilled'] = (donation.learnerCount/denominator)*100;
      }
      if (donation.percentFilled < 100) {
        foundDonor = true;
        if (!donation.hasOwnProperty('learners')) {
          donation['learners'] = [];
        }
        donation['learners'].push(data);
        learners.splice(0, 1);
        donation.percentFilled = Math.round(calculatePercentFilled(donation));
        // log the moment a donation is filled
        if (donation.percentFilled >= 100) {
          console.log('filled donation ', donation.id)
          fullDonations++;
          writeEndDate(donation);
        }
      } else {
        fullDonations = markDonationFilled(donation);
      }
    }
    if (!foundDonor) {
      // if there are no matching donors, check to see if this learner has
      // expired
      checkUserExpirationDate(learners[0]);
      learners.splice(0, 1);
    }
  }
}

/**
* @param{Object[]} priorityQueue the list of donations to update in firestore
*/
function batchLearnerAssignment(priorityQueue) {
  const batchMax= 495;
  let batchSize = 0;
  let batchCount = 0;
  let batches = [];
  batches[batchCount] = firestore.batch();
  const poolRef = firestore.collection('user_pool');
  priorityQueue.forEach((donation, i)=>{
    const msgRef = firestore.collection('donor_master')
        .doc(donation.sourceDonor)
        .collection('donations').doc(donation.id).collection('users');
    if (donation.hasOwnProperty('learners')) {
      donation.learners.forEach((learner) =>{
        if (batchSize >= batchMax) {
          batchSize = 0;
          batchCount++;
          batches[batchCount] = firestore.batch();
        }
        const docRef = msgRef.doc(learner.userID);
        batches[batchCount].set(docRef, learner);
        const deleteRef = poolRef.doc(learner.userID);
        batches[batchCount].delete(deleteRef);
        batchSize += 2;
      });
    }
  });
  writeToDb(batches);
}

/**
* @return {QueryDocumentSnapshot} an unsorted QueryDocumentSnapshot of learners
*                                 no greater than the size of donationCount
* @param{num} donationCount the maximum length of the learnerQueue
* @param{num} interval the age cap on any learner fetched from the database
*/
async function getLearnerQueue(donationCount, interval) {
  const pivotDate = new Date(Date.now()-(DAYINMS*interval));
  return firestore.collection('user_pool').where('dateCreated', '>=', pivotDate)
      .orderBy('dateCreated', 'asc').get().then((snap)=>{
        console.log('fetched snap of size ', snap.size);
        return snap;
      }).catch((err)=>{
        console.error(err);
      });
}

/**
* @return{QueryDocumentSnapshot} A QueryDocumentSnapshot of donations sorted by
*                                percent filled and date started.
*/
function getPriorityQueue() {
  return firestore.collectionGroup('donations')
      .where('percentFilled', '<', 100)
      .orderBy('percentFilled', 'desc')
      .orderBy('startDate', 'asc').get().then((snap)=>{
        if (snap.empty) {
          console.log('no un-filled donations');
          return undefined;
        }
        let priorityQueue = [];
        let monthlyQueue = [];
        let oneTimeQueue = [];
        snap.forEach((doc)=>{
          let data = doc.data();
          data['id'] = doc.id;
          if (data.frequency === 'monthly') {
            monthlyQueue.push(data);
          } else {
            oneTimeQueue.push(data);
          }
        });
        monthlyQueue.forEach((elem)=>{
          priorityQueue.push(elem);
        });
        oneTimeQueue.forEach((elem) => {
          priorityQueue.push(elem);
        });
        return priorityQueue;
      }).catch((err)=>{
        console.error(err);
      });
}

// ************************Helper Functions********************************* //

/**
* determine whether a learner can be assigned to the given donation
* @return {bool} true if the learner is valid for the donation, false otherwise
* @param {Object} learner the learner object to compare
* @param {Object} donation the donation object to compare
*/
function checkForMatch(learner, donation) {
  if (donation.country === 'any') return true;
  if (donation.country === learner.country) return true;
  if (CONTINENTS.includes(donation.country)) {
    if (donation.country === learner.continent) {
      return true;
    }
    return false;
  }
}

/**
* @return {num} the modified donation count
* @param{Object} donation the donation object to modify
* @param{num} count the current count of filled donations
*/
function markDonationFilled(donation, count) {
  if (!donation.hasOwnProperty('isCounted')) {
    donation['isCounted'] = false;
  }
  if (!donation.isCounted) {
    donation.isCounted = true;
    count++;
  }
  return count;
}

/**
* @return {num} the new percentage
* @param{Object} donation the donation object to calculate
*/
function calculatePercentFilled(donation) {
  const newCount = donation.learnerCount + donation.learners.length;
  const donationMax = Math.round(donation.amount/donation.costPerLearner);
  return (newCount/donationMax) * 100;
}

/**
* @param{Object} donation the donation object to mark finished
*/
function writeEndDate(donation) {
  donation['isCounted'] = true;
  firestore.collection('donor_master').doc(donation.sourceDonor)
      .collection('donations').doc(donation.id).set({
        endDate: admin.firestore.Timestamp.now(),
      }, {merge: true}).catch((err)=>{
        console.error(err);
      });
}

/**
* @param{Object} user the user object whose expiration date we are checking
*/
function checkUserExpirationDate(user) {
  let data = user.data();
  if (data.dateCreated <= getPivot() ) {
    setTimeout((user)=>{
      firestore.collection('unassigned_users').doc(user.id).set(user.data());
      firestore.collection('user_pool').doc(user.id).delete();
    }, 1010, user);
  }
}

/**
* @return {Object} the original QueryDocumentSnapshot
*                  with a modified docs member
* @param{Object} snap1 The QueryDocumentSnapshot to modify
* @param{Promise} promise a Promise that resolves into a QueryDocumentSnapshot
*/
async function snapConcat(snap1, promise) {
  const snap2 = await promise;
  snap1.docs = snap1.docs.concat(snap2.docs);
  return snap1;
}

/**
* @return{Object[]} an array of LearnerObjects sorted by expiration date and
*                   presence of detailed location data
* @param{QueryDocumentSnapshot} queue an unsorted QueryDocumentSnapshot
*/
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

function getPivot () {
  const nowInMillis = admin.firestore.Timestamp.now().toMillis();
  const pivot = nowInMillis - (DAYINMS * PRUNEDATE);
  const timestamp = admin.firestore.Timestamp.fromMillis(pivot);
  return timestamp;
}

/**
* @return {Promise} a promise that waits for 1 second before continuing
*/
function waitForSecond() {
  return new Promise((resolve) =>{
    setTimeout(()=>{
      resolve('resolved');
    }, 1010);
  });
}

/**
* Loop through an array of firestore batches and commit each one
* working at a rate of 1 batch/second
* @param{Object[]} arr the array of batches to commit to
*/
async function writeToDb(arr) {
  console.log('beginning write');
  for (let i = 0; i < arr.length; i++) {
    console.log('writing batch: ' + i);
    await waitForSecond();
    arr[i].commit().then(function() {
      console.log('wrote batch: ' + i);
    }).catch((err)=>{
      console.error(err);
    });
  }
}
