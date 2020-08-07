const admin = require('firebase-admin');
const fs = require('fs');
// const firebase = require('firebase/app');
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
    let newBlock = '==========================================\n\n';
    let curDate = new Date(Date.now());
    let dateString = curDate.getFullYear() + '-' + (curDate.getMonth()+1) + '-' + curDate.getDate() + '\n\n';
    let donationCount = vals[1] + ' unfilled donations.\n\n';
    let countryReport = generateCountryReport(vals[0], vals[2]);
    let data = newBlock + dateString + donationCount + countryReport;
    fs.appendFileSync('dashboard_metrics.txt', data, function(err) {
      if (err) throw err;
      console.log('Successfully wrote file');
    });
  }).catch((err)=>{
    console.error(err);
  })
}
main();

function generateCountryReport(learners, donations) {
  let report = {};
  for (let country in learners) {
    if (learners[country] !== undefined) {
      if (report[country] === undefined) {
        report[country] = {
          learnerCount: 0,
          donationCount: 0,
          donationsTotal: 0,
          remainingValue: 0,
        };
      }
      report[country].learnerCount = learners[country];
      if (donations[country] !== undefined) {
        report[country].donationCount = donations[country].donationCount;
        report[country].donationsTotal = donations[country].totalValue;
        report[country].remainingValue = donations[country].remainingValue;
      }
    }
  }
  let result = "Metrics By Country:\n";
  for (let country in report) {
    if (report[country] !== undefined) {
      result += '\t'+country+':\n'+'\t\t'+
          'learners: '+report[country].learnerCount +
          '\n\t\t'+'unfilled-donation-count: '+report[country].donationCount+
          '\n\t\t'+'donation-total: '+report[country].donationsTotal+
          '\n\t\t'+'dollars-remaining: '+report[country].remainingValue+'\n';
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
