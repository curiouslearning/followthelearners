const admin = require('firebase-admin');
const bqController = require('../../helpers/bigQueryController');
const fs = require('fs');
const {BigQuery} = require('@google-cloud/bigquery');
if (admin.apps.length === 0) {
  admin.initializeApp();
}
const firestore = admin.firestore();
const Timestamp = admin.firestore.Firestore.Timestamp;
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

exports.exportAssignedUsersToBigQuery = async () => {
  const pivotDate= new Date(Date.now() - DAYINMS);
  const pivotTimestamp = Timestamp.fromDate(pivotDate);
  const dateString = pivotDate.toISOString().slice(0, 10);
  const dbref = firestore.collection('user_pool');
  const query = dbref.where('assignedOn', '>=', pivotTimestamp);
  return await query.get().then((snap) => {
    if (snap.empty) {
      console.log('empty snap');
      return snap;
    }
    const donations = this.getDonations(snap);
    return this.joinDonorCampaigns(snap, donations);
  }).then((rows) => {
    if (rows.length === 0) return {data: 'no-data'};
    const data = this.formatRawAssignmentData(rows);
    const filename = `/tmp/assigned-learners-${dateString}.json`;
    fs.writeFileSync(filename, data, (err) => {
      if (err) throw err;
      console.log('Successfully wrote file');
    });
    return bqController.loadIntoBigQuery(filename);
  }).then((result) => {
    return {data: result, error: null};
  }).catch((err) => {
    console.error(err);
    return {data: null, error: err};
  });
};

exports.formatRawAssignmentData = (rawData) => {
  let dataString = '';
  rawData.forEach((docFields) => {
    docFields.assignedOn = this.getDateString(docFields.assignedOn);
    docFields.dateCreated = this.getDateString(docFields.dateCreated);
    docFields.dateIngested = this.getDateString(docFields.dateIngested);
    if (docFields.countedInCampaign) {
      delete docFields.countedInCampaign;
    }
    if (docFields.countedInMasterCount) {
      delete docFields.countedInMasterCount;
    }
    if (docFields.countedInRegion) {
      delete docFields.countedInRegion;
    }
    dataString += JSON.stringify(docFields) + '\n';
  });
  return dataString;
};

// TODO: Make this obsolete by adding campaign to learner docs
exports.joinDonorCampaigns = async function(snap, donations) {
  let docRefs = [];
  donations.forEach((elem) => {
    docRefs.push(firestore.collection('donor_master')
        .doc(elem.donor).collection('donations').doc(elem.donation)
        .get().then((doc) => {
          if (doc.exists) return doc.data();
          return {};
        }));
  });
  return Promise.all(docRefs).then((vals)=>{
    let rows = [];
    vals.forEach((val) => {
      if (val !== {}) {
        snap.forEach((doc) => {
          const data = doc.data();
          if (val.donationID === data.sourceDonation) {
            data['assignedCampaign'] = val.campaignID;
            rows.push(data);
          }
        });
      }
    });
    return rows;
  }).catch((err)=>{
    console.error(err);
  });
};

exports.getDonations = function(snap) {
  let donations = [];
  snap.forEach((doc) => {
    const data = doc.data();
    if (!donations.includes(data.sourceDonation)) {
      donations.push({
        donor: data.sourceDonor,
        donation: data.sourceDonation,
      });
    }
  });
  return donations;
};

/**
* converts a Firestore Timestamp to ISO 8601 YYYY-MM-DD format
* @param {Timestamp} timestamp the Firestore Timestamp to convert
* @return {string} the ISO 8601 formatted date for the Timestamp
*/
exports.getDateString = (timestamp) => {
  const date = new Date(timestamp.toMillis());
  return date.toISOString().slice(0, 10);
};
