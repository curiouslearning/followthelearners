const admin = require('firebase-admin');
const fs = require('fs');
const {BigQuery} = require('@google-cloud/bigquery');
const serviceAccount = require('./keys/firestore-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const firestore = admin.firestore();
const DAYINMS = 86400000;
const PRUNEDATE = 7;

function main() {
  const pivotDate = getPivot(PRUNEDATE);
  const today = getPivot(1);
  let learners = getLearnersPerCountry();
  let latestLearners = getTodaysLearners(today);
  let assignments = getTodaysAssignments(today);
  let expirations = getTodaysExpirations(today);
  let demand = getDemand();
  let amounts = getDonationsByCountry(pivotDate);
  Promise.all([
    learners,
    demand,
    amounts,
    latestLearners,
    assignments,
    expirations,
  ]).then((vals)=>{
    let curDate = new Date(Date.now());
    let dateString = curDate.getFullYear() + '-' + (curDate.getMonth()+1) + '-' + curDate.getDate();
    let data = generateCountryReport(vals, dateString);
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

function generateCountryReport(vals, dateString) {
  let report = {};
  let learners = vals[0];
  let demand = vals[1];
  let donations = vals[2];
  let ingestions = vals[3];
  let assignments = vals[4];
  let expirations = vals[5];
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
          ingestedLearners: 0,
          learnersAssignedToday: 0,
          learnersExpiredToday: 0,
          demand: 0,
        };
      }
      report[country].unassignedLearners= learners[country];
      if (demand[country] !== undefined) {
        report[country].demand = Math.round(demand[country]);
      }
      if (ingestions[country] !== undefined) {
        report[country].ingestedLearners = ingestions[country];
      }
      if (assignments[country] !== undefined) {
        report[country].learnersAssignedToday = assignments[country];
      }
      if (expirations[country] !== undefined) {
        report[country].learnersExpiredToday = expirations[country];
      }
      if (donations[country] !== undefined) {
        const costPerLearner =donations[country].costPerLearner;
        report[country].donationCount = donations[country].donationCount;
        report[country].donationsTotal = donations[country].totalValue;
        const learnersAssigned =
          Math.round(donations[country].totalValue/costPerLearner);
        report[country].learnersAssigned = learnersAssigned
        report[country].remainingValue = donations[country].remainingValue;
        if (report[country].remainingValue < 0) {
          report[country].remainingValue = 0;
        }
        const learnersToAssign =
          Math.round(report[country].remainingValue/costPerLearner);
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

function getTodaysLearners(pivotDate) {
  return firestore.collection('user_pool')
      .where('dateIngested', '>=', pivotDate).get().then((snap)=>{
        if (snap.empty) return [];
        let countries = {};
        snap.forEach((doc)=>{
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

function getTodaysAssignments(pivotDate) {
  return firestore.collectionGroup('users')
      .where('assignedOn', '>=', pivotDate).get().then((snap)=>{
        if (snap.empty) return [];
        let countries = {};
        snap.forEach((doc)=>{
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

function getTodaysExpirations(pivotDate) {
  return firestore.collection('unassigned_users')
      .where('expiredOn', '>=', pivotDate).get().then((snap)=>{
        if (snap.empty) return [];
        let countries = {};
        console.log('expirations: ', snap.size);
        snap.forEach((doc)=>{
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

function getDemand() {
  const dbRef = firestore.collectionGroup('donations');
  return dbRef.where('percentFilled', '<', 100).get().then((snap)=>{
    if (snap.empty) return {};
    let countries = {};
    snap.forEach((doc)=>{
      let data = doc.data();
      if (countries[data.country] === undefined) {
        countries[data.country] = 0;
      }
      const demand = data.amount / data.costPerLearner
      countries[data.country] += demand;
    });
    return countries;
  }).catch((err) => {
    console.error(err);
  });
}

function getDonationsByCountry(pivotDate) {
  const dbRef = firestore.collectionGroup('donations');
  return dbRef.get().then((snapshot)=>{
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
      let remainder = data.amount - (data.amount * (data.percentFilled/100));
      if (isNaN(remainder) || remainder < 0) {
        remainder = 0;
      }
      countries[data.country].totalValue += data.amount;
      countries[data.country].remainingValue += remainder;
      countries[data.country].donationCount++;
    });
    return countries;
  }).catch((err) => {
    console.error(err);
  });
}

function getPivot(interval = 0) {
  const pivot = Date.now() - (DAYINMS * interval);
  const timestamp = admin.firestore.Timestamp.fromMillis(pivot);
  return timestamp;
}
