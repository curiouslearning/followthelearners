const admin = require('firebase-admin');
const fs = require('fs');
const {BigQuery} = require('@google-cloud/bigquery');
const DAYINMS = 86400000;
const PRUNEDATE = 7;
const serviceAccount = require('./keys/firestore-key.json');
const args = process.argv.slice(2);
const jobName = 'dashboard_metrics';

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const firestore = admin.firestore();


let parsedDate = new Date(Number(args[0].substring(0,4)), (Number(args[0].substring(4,6)) -1), Number(args[0].substring(6,8)));

console.log('args[0] is: ', args[0]);
console.log('substrings: ');
console.log('year: ', args[0].substring(0,4));
console.log('month: ', args[0].substring(4,6));
console.log('day: ', args[0].substring(6,8));

async function main(date) {
  console.log('date is: ', date);
  const job = await saveJob({jobName, jobStatus: 'started', dateStarted: new Date(Date.now()).toISOString()});
  const pivotDate = getPivot(PRUNEDATE, date);
  const today = getPivot(1, date);
  let learners = await getLearnersPerCountry();
  // let learners2 = await getLearnersPerCountryOld();
  let latestLearners = await getTodaysLearners(today, date);
  let assignments = await getTodaysAssignments(today, date);
  let expirations = await getTodaysExpirations(today, date);
  let demand = await checkDemand(date);
  let amounts = await getDonationsByCountry(pivotDate, date);

  let vals;
  try {
    vals = await
    Promise.all([
      learners,
      demand,
      amounts,
      latestLearners,
      assignments,
      expirations,
    ]);
  } catch(err) {
    console.error(err);
    await saveJob({
      jobId: job.job_id,
      jobStatus: 'Failed',
      dateCompleted: new Date(Date.now()).toISOString(),
      jobResults: 'Failed to update dashboard metrics',
      errorLogs: JSON.stringify(err)
    });
    return;
  }
  let dateString = date.getFullYear() + '-' + (date.getMonth()+1) + '-' + date.getDate();
  console.log('datestring: ', dateString);
  // let data = generateCountryReport(vals, dateString);
  // let filename = 'dashboard_metrics_'+dateString+'.json';
  // fs.writeFileSync(filename, data, function(err) {
  //   if (err) throw err;
  //   console.log('Successfully wrote file');
  // });
  // await loadIntoBigQuery(filename);
  //TODO delete file
  await saveJob({
    jobId: job.job_id,
    jobStatus: 'completed',
    recordsProcessed: Object.values(latestLearners).reduce((p, c) => p + c),
    dateCompleted: new Date(Date.now()).toISOString(),
    jobResults: 'Successfully updated dashboard metrics'
  });
}
(async () => {await main(parsedDate);})();

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
    if (!learners.hasOwnProperty(country) || learners[country] === undefined) continue;

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

    report[country].unassignedLearners = learners[country];
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
      const costPerLearner = donations[country].costPerLearner;
      report[country].donationCount = donations[country].donationCount;
      report[country].donationsTotal = donations[country].totalValue;
      report[country].learnersAssigned = Math.round(donations[country].totalValue/costPerLearner);
      report[country].remainingValue = donations[country].remainingValue;

      if (report[country].remainingValue < 0) {
        report[country].remainingValue = 0;
      }

      report[country].learnersToAssign = Math.round(report[country].remainingValue/costPerLearner);;
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
  return firestore.collection('aggregate_data').get().then((snapshot) => {
    let countries = {};
    const regions = snapshot.docs.find(s => s.data().hasOwnProperty('countries'));

    for(const region of regions.data().countries) {
      countries[region.country] = region.learnerCount;
    }
    return countries;
  }).catch((err)=>{
    console.error(`Error when trying to get the learners per country: ${JSON.stringify(err)}`);
    throw err;
  });
}

function getLearnersPerCountryOld() {
  const dbRef = firestore.collection('user_pool');
  //TODO - do we need to get all of the users or simply users from the past 24h?
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
    console.error(`Error when trying to get the learners per country: ${JSON.stringify(err)}`);
    throw err;
  });
}

function checkDemand(date) {
  return date < new Date(Date.now) ? getHistoricalDemand(date) : getDemand();
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

async function saveJob({jobId, jobName, jobStatus, jobResults, recordsProcessed, errorLogs, dateStarted, dateCompleted}) {
  const bigqueryClient = new BigQuery();

  const wrap = s => s ? `"${s}"` : null;

  const sqlQuery = `call \`follow-the-learners.ftl_dataset.jobs_save\`(${wrap(jobId)}, ${wrap(jobName)},` +
      `${wrap(jobStatus)},${wrap(jobResults)},${wrap(recordsProcessed)},` +
      `${wrap(errorLogs)},${wrap(dateStarted)},${wrap(dateCompleted)})`;

  const options = {
    query: sqlQuery,
    location: 'US'
  };

  try {
    const [rows] = await bigqueryClient.query(options);
    return rows[0];
  } catch(err) {
    console.error(`Error when trying to save the job: ${JSON.stringify(err)}`);
  }
}

function getPivot(interval = 0, startDate = new Date()) {
  const pivot = startDate.getTime() - (DAYINMS * interval);
  return admin.firestore.Timestamp.fromMillis(pivot);
}
