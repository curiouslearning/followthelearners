const admin = require('firebase-admin');
const lodash = require('lodash');
const bqController = require('../../helpers/bigQueryController');
const helpers = require('../../helpers/helpers');
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

exports.exportAssignedUsersToBigQuery = async (interval) => {
  const pivotDate= new Date(Date.now() - (DAYINMS * interval));
  const pivotTimestamp = Timestamp.fromDate(pivotDate);
  const dateString = pivotDate.toISOString().slice(0, 10);
  const filename = `assigned-learners_${dateString}.json`;
  const dbref = firestore.collection('user_pool');
  const query = dbref.where('assignedOn', '>=', pivotTimestamp);
  const summary = await query.get().then(async (snap) => {
    if (snap.empty) {
      console.log('empty snap');
      return false;
    }
    let rows = [];
    snap.forEach((doc) => {
      const data = doc.data();
      rows.push(data);
    });
    const data = this.formatRawAssignmentData(rows);
    if (lodash.isNil(data) || data.length === null) {
      console.warn('no assignment data for today');
      return;
    }
    const wf = await helpers.writeFile(filename, data);
    if (wf === 'success') {
      console.log(`Successfully wrote file ${filename}`);
    }
    const result = await bqController.loadIntoBigQuery(filename, 'assigned_learners');
    if (result) {
      helpers.deleteFile(filename);
      return {data: result, error: null};
    } else {
      return {
        data: result,
        error: `error uploading to bigquery. file ${filename} not deleted`,
      };
    }
  }).catch((err) => {
    console.error(err);
    return {data: null, error: err};
  });
  if (summary.data) {
    console.log(`successfully uploaded today's assignments to bigqury`);
  } else {
    console.log(`upload did not complete`);
    console.log(summary.error);
  }
  return summary;
};

exports.formatRawAssignmentData = (rawData) => {
  let dataString = '';
  rawData.forEach((docFields) => {
    docFields.assignedOn = this.getDateString(docFields.assignedOn);
    docFields.dateCreated = this.getDateString(docFields.dateCreated);
    docFields.dateIngested = this.getDateString(docFields.dateIngested);
    if (!lodash.isNil(docFields['countedInCampaign'])) {
      delete docFields['countedInCampaign'];
    }
    if (!lodash.isNil(docFields['countedInMasterCount'])) {
      delete docFields['countedInMasterCount'];
    }
    if (!lodash.isNil(docFields['countedInRegion'])) {
      delete docFields['countedInRegion'];
    }
    dataString += JSON.stringify(docFields) + '\n';
  });
  return dataString;
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
