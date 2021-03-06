const admin = require('firebase-admin');
const isNil = require('lodash/isNil');
const DONATIONFILLTIMELINE = 14; // The min number of days to fill a donation
const PRUNEDATE = 7; // the number of days before a new user expires
const DAYINMS = 86400000;
const CONTINENTS = [
  'Africa',
  'Americas',
  'Antarctica',
  'Asia',
  'Europe',
  'Oceania',
];
if (admin.apps.length === 0) {
  admin.initializeApp();
}
const {BatchManager} = require('../helpers/BatchManager');
const firestore = admin.firestore();

async function main() {
  await assignExpiringLearners();
}
(async () => {await main();})();

async function assignExpiringLearners() {
  let priorityQueue, learnerSnap;

  try {
    priorityQueue = await getPriorityQueue();
    learnerSnap = await getLearnerQueue();
  } catch(err) {
    console.error('Error when trying to pull users and learners.  Aborting');
    console.error(err);
    return;
  }

  if(priorityQueue.length === 0) {
    console.warn('There are no donors to process');
    return; // early return for no donations
  }
  if(isNil(learnerSnap) || learnerSnap.empty) {
    console.warn('No new learners to assign');
    return; // early return for no users
  }

  console.log('prioritizing snap of size ', learnerSnap.size);
  let learnerQueue = learnerSnap.docs.sort(
      (a, b) => {return a.data().region === 'no-region' ? 1 : b.data().region === 'no-region' ? -1 : 0});

  console.log('learnerQueue length: ', learnerQueue.length);
  console.log('priority queue length:', priorityQueue.length);
  matchLearnersToDonors(learnerQueue, priorityQueue);
  await batchLearnerAssignment(priorityQueue);
  await sweepExpiredLearners();
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
  console.log(`matching ${learners.length} learners to ${donations.length} donors`);
  while ((learners.length > 1) && (fullDonations < donations.length)) {
    if (learners[0] === undefined) {
      learners.splice(0, 1);
      continue;
    }
    let foundDonor = false;
    for (let i=0; i < donations.length; i++) {
      let donation = [];
      donation = donations[i];
      let data = learners[0].data();
      if (!checkForMatch(data, donation)) {
        // only assign users to donations from matching campaigns
        continue;
      }
      console.log('found potential match');
      if (!donation.percentFilled) {
        let denominator = donation.amount/donation.costPerLearner
        donation['percentFilled'] = (donation.learnerCount/denominator)*100;
      }
      const cap = calculateLearnerCap(donation);
      console.log('cap is ', cap);

      if (!donation.learners || (donation.learners.length < cap)) {
        console.log('found donor: ', donation.sourceDonor);
        foundDonor = true;
        if (!donation.hasOwnProperty('learners')) {
          donation['learners'] = [];
        }
        data.sourceDonor = donation.sourceDonor;
        data.userStatus = 'assigned';
        data.sourceDonation = donation.donationID;
        data['assignedCampaign'] = donation.campaignID;
        data['learnerCost'] = donation.costPerLearner;
        data['assignedOn'] = admin.firestore.Timestamp.now();
        donation['learners'].push(data);
        learners.splice(0, 1);
        donation.percentFilled = Math.round(calculatePercentFilled(donation));
        // log the moment a donation is filled
        if (donation.percentFilled >= 100) {
          console.log('filled donation ', donation.id)
          fullDonations = markDonationFilled(donation, fullDonations);
          writeEndDate(donation);
        }
      } else {
        console.log(`${donation.id} is full for the day`);
        fullDonations = markDonationFilled(donation, fullDonations);
      }
    }
    console.log(`${fullDonations} donations removed from queue`)
    if (!foundDonor) {
      // remove matchless learners to prevent infinite loops
      learners.splice(0, 1);
    }
  }
  console.log(`ending with ${learners.length} free learners`);
  console.log(`${(donations.length - fullDonations)|| 0} open donations`);
}

function calculateLearnerCap(donation) {
  const amount = donation.amount;
  const costPerLearner = donation.costPerLearner;
  let maxLearners = Math.round(amount/costPerLearner);
  if (maxLearners < 1) maxLearners = 1;
  let maxDailyIncrease = Math.round(maxLearners/DONATIONFILLTIMELINE);
  if (maxDailyIncrease < 1) maxDailyIncrease = 1;
  return maxDailyIncrease;
}

/**
* @param{Object[]} priorityQueue the list of donations to update in firestore
*/
async function batchLearnerAssignment(priorityQueue) {
  let batch = new BatchManager();
  const poolRef = firestore.collection('user_pool');
  priorityQueue.forEach((donation, i)=>{
    if (donation.hasOwnProperty('learners')) {
      donation.learners.forEach((learner) =>{
        const docRef = poolRef.doc(learner.userID);
        batch.set(docRef, learner, true);
      });
    }
  });
  await batch.commit();
}

/**
* @return {QueryDocumentSnapshot} an unsorted QueryDocumentSnapshot of learners
*                                 no greater than the size of donationCount
*/
async function getLearnerQueue() {
  let snap;
  try {
    snap = await firestore.collection('user_pool')
        .where('userStatus', '==', 'unassigned')
        .orderBy('dateCreated', 'asc').get();
  } catch(err) {
    console.error(`Error when trying to retrieve the users: ${JSON.stringify(err)}`);
    throw err;
  }
  console.log('fetched snap of size ', snap.size);
  return snap;
}

/**
* @return{QueryDocumentSnapshot} A QueryDocumentSnapshot of donations sorted by
*                                percent filled and date started.
*/
async function getPriorityQueue() {
  let snap;
  try {
    snap = await firestore.collectionGroup('donations')
        .where('percentFilled', '<', 100)
        .orderBy('percentFilled', 'desc')
        .orderBy('startDate', 'asc').get();
  } catch(err) {
    console.err(`Error when trying to pull the donations: ${JSON.stringify(err)}`);
    throw err;
  }

  if (snap.empty) {
    console.log('no un-filled donations');
    return [];
  }

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
  return monthlyQueue.concat(oneTimeQueue);
}

async function sweepExpiredLearners() {
  const pivot = getPivot();
  const poolRef = firestore.collection('user_pool');
  let batch = new BatchManager();
  let snap;
  try {
    snap = await poolRef.where('userStatus', '==', 'unassigned')
        .where('dateCreated', '<=', pivot).get();
  } catch(err) {
    console.error(`Error when trying to sweep expired users: ${JSON.stringify(err)}`);
    return;
  }

  if (snap.empty) {
    console.log('empty snap');
    return [];
  }
  snap.forEach((doc)=>{
    let data = doc.data();
    data.userStatus = 'expired';
    data['expiredOn'] = admin.firestore.Timestamp.now();
    batch.set(poolRef.doc(doc.id), data, true);
  });
  return batch.commit();
}

// ************************Helper Functions********************************* //

/**
* determine whether a learner can be assigned to the given donation
* @return {bool} true if the learner is valid for the donation, false otherwise
* @param {Object} learner the learner object to compare
* @param {Object} donation the donation object to compare
*/
function checkForMatch(learner, donation) {
  return donation.country === 'any' ||
         donation.country === learner.country ||
         (donation.country === learner.continent && CONTINENTS.includes(donation.country));
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

function getPivot() {
  const nowInMillis = admin.firestore.Timestamp.now().toMillis();
  let pivot = nowInMillis - (DAYINMS * PRUNEDATE);
  return admin.firestore.Timestamp.fromMillis(pivot);
}
