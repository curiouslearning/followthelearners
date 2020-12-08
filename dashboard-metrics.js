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

const args = process.argv.slice(2);
let parsedDate = new Date();
console.log('args[0] is: ', args[0]);
console.log('substrings: ');
console.log('year: ', args[0].substring(0,4));
console.log('month: ', args[0].substring(4,6));
console.log('day: ', args[0].substring(6,8));
parsedDate.setFullYear(Number(args[0].substring(0,4)));
parsedDate.setMonth(Number(args[0].substring(4,6)) -1);
parsedDate.setDate(Number(args[0].substring(6,8)));

function main(date) {
  console.log('date is: ', date);
  const pivotDate = getPivot(PRUNEDATE, date);
  const today = getPivot(1, date);
  let learners = getLearnersPerCountry();
  let latestLearners = getTodaysLearners(today, date);
  let assignments = getTodaysAssignments(today, date);
  let expirations = getTodaysExpirations(today, date);
  let demand = checkDemand(date);
  let amounts = getDonationsByCountry(pivotDate, date);
  Promise.all([
    learners,
    demand,
    amounts,
    latestLearners,
    assignments,
    expirations,
  ]).then((vals)=>{
    let dateString = date.getFullYear() + '-' + (date.getMonth()+1) + '-' + date.getDate();
    console.log('datestring: ', dateString)
    let data = generateCountryReport(vals, dateString);
    let filename = 'dashboard_metrics_'+dateString+'.json';
    fs.writeFileSync(filename, data, function(err) {
      if (err) throw err;
      console.log('Successfully wrote file');
    });
    return filename;
  }).then((filename)=>{
    return loadIntoBigQuery(filename);
  }).catch((err)=>{
    console.error(err);
  })
}
await main(parsedDate);

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

function getTodaysLearners(pivotDate, now) {
  return firestore.collection('user_pool')
      .where('dateIngested', '>=', pivotDate)
      .where('dateIngested', '<=', now).get().then((snap)=>{
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

function getTodaysAssignments(pivotDate, now) {
  return firestore.collection('user_pool')
      .where('assignedOn', '>=', pivotDate)
      .where('assignedOn', '<=', now).get().then((snap)=>{
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

function getTodaysExpirations(pivotDate, now) {
  return firestore.collection('user_pool')
      .where('expiredOn', '>=', pivotDate)
      .where('expiredOn', '<=', now).get().then((snap)=>{
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

function checkDemand(date) {
  if (date < new Date(Date.now)) {
    return getHistoricalDemand(date);
  } else {
    return getDemand();
  }
}

function getHistoricalDemand(date) {
  const dbRef = firestore.collectionGroup('donations');
  return dbRef.where('startDate', '<=', date).get().then((snap)=>{
    if (snap.empty) return {};
    let countries = {};
    snap.forEach((doc)=>{
      let data = doc.data();
      if (data.endDate && data.endDate > date) {
        if ((countries[data.country]) === undefined) {
          countries[data.country] = 0;
        }
        const demand = data.amount / data.costPerLearner;
        countries[data.country] += demand;
      }
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
      const demand = data.amount / data.costPerLearner;
      countries[data.country] += demand;
    });
    return countries;
  }).catch((err) => {
    console.error(err);
  });
}

function getDonationsByCountry(pivotDate, now) {
  const dbRef = firestore.collectionGroup('donations');
  return dbRef.where('startDate', '<=', pivotDate).get().then((snapshot)=>{
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

function getPivot(interval = 0, startDate = new Date(Date.now)) {
  const pivot = startDate.getTime() - (DAYINMS * interval);
  const timestamp = admin.firestore.Timestamp.fromMillis(pivot);
  return timestamp;
}
