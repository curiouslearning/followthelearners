const admin = require('firebase-admin');
const fs = require('fs');
const lodash = require('lodash');
const {BigQuery} = require('@google-cloud/bigquery');
const bqController = require('../../helpers/bigQueryController');
const helpers = require('../../helpers/helpers');
if (admin.apps.length === 0) {
  admin.initializeApp();
}
const Timestamp = admin.firestore.Firestore.Timestamp;
const DAYINMS = 86400000;
const firestore = admin.firestore();

exports.exportUnfilledDonations = async (interval) => {
  const dbRef = firestore.collectionGroup('donations')
      .where('percentFilled', '<', 100);
  const donations = await dbRef.get().then((snap) => {
    return snap;
  }).catch((err) => {
    console.error(`error fetching open donations: `);
    console.error(err);
  });
  const rows = this.formatOpenDonationRows(donations);
  if (lodash.isNil(rows) || rows.length === 0) {
    console.warn('no unfilled donations for today');
    return;
  }
  const dateString = new Date(Date.now()).toISOString().slice(0, 10);
  const filename = `unfilled-donations_${dateString}.json`;
  fs.writeFileSync(`./${filename}`, helpers.stringifyRows(rows), (err) => {
    if (err) {
      console.error(`could not write ${filename}, encountered error:`);
      throw err;
    }
    console.log(`Successfully wrote ${filename}`);
  });
  const res = await bqController.loadIntoBigQuery(filename, 'unfilled_donations');
  if (res) {
    fs.unlinkSync(`./${filename}`);
  }
  return;
};

exports.exportDonationMetrics = async (interval) => {
  const newDonations = await this.fetchNewDonations(interval);
  const rows = this.formatNewDonationRows(newDonations);
  if (lodash.isNil(rows) || rows.length === 0) {
    console.warn('no new donors for today');
    return;
  }
  const date = new Date(Date.now()).toISOString().slice(0, 10);
  const filename = `new-donations_${date}.json`;
  await helpers.writeFile(`./${filename}`, helpers.stringifyRows(rows));
  const tableName = 'donation_history';
  const status = await bqController.loadIntoBigQuery(filename, tableName);
  if (status) {
    helpers.deleteFile(`./${filename}`);
  }
  return;
};

// **********************HELPERS***********************************************/


exports.fetchNewDonations = async (interval) => {
  const date = new Date(Date.now() - (DAYINMS * interval));
  const min = helpers.getCalculatedDateMin(date);
  const max = helpers.getCalculatedDateMax(date);
  return await this.fetchDonationsForDay(min, max);
};

exports.createDonorList = (donations) => {
  let donorList = [];
  donations.forEach((donation) => {
    let data = donation.data();
    if (!donorList.includes(data.sourceDonor)) {
      donorList.push(data.sourceDonor);
    }
  });
  return donorList;
};

exports.fetchDonationsForDay = async (min, max) => {
  const dbRef = firestore.collectionGroup('donations')
      .where('startDate', '>=', Timestamp.fromDate(min))
      .where('startDate', '<=', Timestamp.fromDate(max));
  return await dbRef.get().then((snap)=>{
    return snap;
  }).catch((err) => {
    console.err(`received error when trying to fetch donations between ${min.toISOString()} and ${max.toISOString()}`);
    console.err(err);
    return {empty: true, docs: []};
  });
};

exports.formatOpenDonationRows = (openDonations) => {
  let rows = [];
  if (openDonations.empty) return rows;
  openDonations.forEach((doc) => {
    let data = doc.data();
    if (data.referralSource === null) {
      data.referralSource = 'no-source';
    }
    const today = new Date(Date.now()).toISOString().slice(0, 10);
    const startDate = new Date(data.startDate.toMillis())
        .toISOString()
        .slice(0, 10);
    rows.push({
      date: today,
      startDate: startDate,
      amount: data.amount,
      campaignID: data.campaignID,
      donationID: data.donationID,
      sourceDonor: data.sourceDonor,
      frequency: data.frequency,
      donationReferralSource: data.referralSource,
      learnerCount: data.learnerCount,
      costPerLearner: data.costPerLearner,
      percentFilled: data.percentFilled,
      country: data.country,
    });
  });
  return rows;
};

exports.formatNewDonationRows = (newDonations) => {
  let rows = [];
  if (newDonations.empty) return rows;
  newDonations.forEach((doc) => {
    let data = doc.data();
    if (data.referralSource === null) {
      data.referralSource = 'no-source';
    }
    const startDate = new Date(data.startDate.toMillis())
        .toISOString()
        .slice(0, 10)
        .replace(/-/g, '');
    rows.push({
      startDate: startDate,
      donationID: data.donationID,
      amount: data.amount,
      campaignID: data.campaignID,
      donorID: data.sourceDonor,
      frequency: data.frequency,
      donationReferralSource: data.referralSource,
    });
  });
  return rows;
};

// ******************************UNUSED***************************************/

exports.fetchNewDonors = async (donorList) => {
  let promises = [];
  donorList.forEach((donor) => {
    promises.push(this.fetchDonor(donor));
  });
  return Promise.all(promises).then((vals) => {
    return vals;
  }).catch((err) => {
    console.error('failed to fetch donor documents. Encountered error: ');
    console.error(err);
  });
};

exports.fetchDonor = async (id) => {
  return firestore.collection('donor_master').doc(id).get().then((doc) => {
    return doc;
  }).catch((err) => {
    console.error(`failed to fetch donor with id: ${id}. Encountered error: `);
    console.error(err);
  });
};

exports.findReferral = (donorID, donorList) => {
  for (let i=0; i < donorList.docs.length; i++) {
    let data = donorList.docs[i].data();
    if (data.donorID === donorID) {
      return data.referralID;
    }
  }
  return '';
}
