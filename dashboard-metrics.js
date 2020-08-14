const admin = require('firebase-admin');
const fs = require('fs');
const {BigQuery} = require('@google-cloud/bigquery');
const serviceAccount = require('./keys/firestore-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const firestore = admin.firestore();

function main() {
  let learners = getLearnersPerCountry();
  let donations = getUnfilledDonations();
  let amounts = getDonationsByCountry();
  Promise.all([learners, donations, amounts]).then((vals)=>{
    let curDate = new Date(Date.now());
    let dateString = curDate.getFullYear() + '-' + (curDate.getMonth()+1) + '-' + curDate.getDate();
    let data = generateCountryReport(vals[0], vals[2], dateString);
    fs.writeFileSync('dashboard_metrics.json', data, function(err) {
      if (err) throw err;
      console.log('Successfully wrote file');
    });
  }).then(()=>{
    return loadIntoBigQuery('dashboard_metrics.json');
  }).catch((err)=>{
    console.error(err);
  })
}
main();

async function loadIntoBigQuery(filename) {
  const bigQueryClient = new BigQuery();
  const dataset = bigQueryClient.dataset('ftl_dataset')
  const table = dataset.table('dashboard_metrics');
  const metadata = {
    encoding: 'UTF-8',
    writeDisposition: 'WRITE_APPEND',
    sourceFormat: 'NEWLINE_DELIMITED_JSON',
    schemaUpdateOption: 'ALLOW_FIELD_ADDITION',
    destinationTable: table,
  };
  await table.load('./'+filename, metadata, (err, apiResponse) =>{
    if (err) throw err;
    console.log('Successfully uploaded to BigQuery');
  });
}

function generateCountryReport(learners, donations, dateString) {
  let report = {};
  for (let country in learners) {
    if (learners[country] !== undefined) {
      if (report[country] === undefined) {
        report[country] = {
          country: country,
          date: dateString,
          unassignedLearners: 0,
          donationCount: 0,
          donationsTotal: 0,
          learnersAssigned: 0,
          remainingValue: 0,
          learnersToAssign: 0,
        };
      }
      report[country].unassignedLearners= learners[country];
      if (donations[country] !== undefined) {
        const costPerLearner =donations[country].costPerLearner;
        report[country].donationCount = donations[country].donationCount;
        report[country].donationsTotal = donations[country].totalValue;
        const learnersAssigned =
          Math.round(donations[country].totalValue/costPerLearner);
        report[country].learnersAssigned = learnersAssigned
        report[country].remainingValue = donations[country].remainingValue;
        const learnersToAssign =
          Math.round(donations[country].remainingValue/costPerLearner);
        report[country].learnersToAssign= learnersToAssign;
      }
    }
  }
  result = '';
  for (let country in report) {
    if (report[country] !== undefined) {
      result += JSON.stringify(report[country]) + '\n';
    }
  }
  return result;
}

function getLearnersPerCountry() {
  const dbRef = firestore.collection('user_pool');
  return dbRef.get().then((snapshot)=>{
    if (snapshot.empty) return [];
    let countries = {};
    snapshot.forEach((doc)=>{
      let data = doc.data();
      if (countries[data.country] === undefined) {
        countries[data.country] = 0;
      }
      countries[data.country]++;
    });
    return countries;
  }).catch((err)=>{
    console.error(err);
  });
}

function getUnfilledDonations() {
  const dbRef = firestore.collectionGroup('donations');
  return dbRef.where('percentFilled', '<', 100).get().then((snapshot)=>{
    return snapshot.size;
  }).catch((err) => {
    console.error(err);
  });
}

function getDonationsByCountry() {
  const dbRef = firestore.collectionGroup('donations');
  return dbRef.where('percentFilled', '<', 100).get().then((snapshot)=>{
    if (snapshot.empty) return 0;
    let countries = {};
    snapshot.forEach((doc)=>{
      let data = doc.data();
      if (countries[data.country] === undefined) {
        countries[data.country] = {
          donationCount: 0,
          remainingValue: 0,
          totalValue: 0,
          costPerLearner: data.costPerLearner,
        };
      }
      countries[data.country].totalValue += data.amount;
      countries[data.country].remainingValue +=
        data.amount - (data.amount * (data.percentFilled/100));
      countries[data.country].donationCount++;
    });
    return countries;
  }).catch((err) => {
    console.error(err);
  });
}
