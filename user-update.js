const {BigQuery} = require('@google-cloud/bigquery');
const fireStoreAdmin = require('firebase-admin');
// const firebase = require('firebase/app');
const serviceAccount = require('./keys/firestore-key.json');
const PRUNEDATE = 5;
const DAYINMS = 86400000;

fireStoreAdmin.initializeApp({
  credential: fireStoreAdmin.credential.cert(serviceAccount),
});
const firestore = fireStoreAdmin.firestore();
/**
* main function
*/
function main() {
  /**
  * Fetch new users from the last 24 hours
  *
  */
  async function fetchUpdatesFromBigQuery() {
    const bigQueryClient = new BigQuery();
    const tables =[
      `tinkrplayer.analytics_175820453.events_*`,
      `ftm-brazilian-portuguese.analytics_161789655.events_*`,
      `ftm-hindi.analytics_174638281.events_*`,
      `ftm-zulu.analytics_155849122.events_*`,
      `ftm-swahili.analytics_160694316.events*`,
      `ftm-english.analytics_152408808.events_*`,
      `ftm-afrikaans.analytics_177200876.events_*`,
      `ftm-australian-english.analytics_159083443.events_*`,
      `ftm-brazilian-portuguese.analytics_161789655.events_*`,
      `ftm-french.analytics_173880465.events_*`,
      `ftm-hausa.analytics_164138311.events_*`,
      `ftm-indian-english.analytics_160227348.events_*`,
      `ftm-isixhosa.analytics_180747962.events_*`,
      `ftm-kinayrwanda.analytics_177922191.events_*`,
      `ftm-ndebele.analytics_181170652.events_*`,
      `ftm-oromo.analytics_167539175.events_*`,
      `ftm-sepedi.analytics_180755978.events_*`,
      `ftm-sesotho.analytics_177536906.events_*`,
      `ftm-siswati.analytics_181021951.events_*`,
      `ftm-somali.analytics_159630038.events_*`,
      `ftm-southafricanenglish.analytics_173750850.events_*`,
      `ftm-spanish.analytics_158656398.events_*`,
      `ftm-tsonga.analytics_177920210.events_*`,
      `ftm-tswana.analytics_181020641.events_*`,
      `ftm-venda.analytics_179631877.events_*`,
    ];
    let query = '';
    tables.forEach((table)=>{
      if (query != '') {
        query = query.concat(' UNION ALL ');
      }
      const subquery = `SELECT
        DISTINCT user_pseudo_id,
        event_name,
        event_date,
        traffic_source.name,
        geo.continent,
        geo.country,
        geo.region
      FROM
        \``+ table+`\`
      WHERE
        _TABLE_SUFFIX =
          FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY))
      AND
        event_name = \"first_open\"`;
      query = query.concat(subquery);
    });

    const options = {
      query: query,
      location: 'US',
    };

    try {
      const [rows] = await bigQueryClient.query(options);
      console.log('successful Query');
      const batchMax = 490;
      let batchCounter = 0;
      let commitCounter = 0;
      const batches = [];
      const usedIDs = [];
      let doubleCounter = 0;
      batches[commitCounter] = firestore.batch();
      rows.forEach((row)=>{
        if (batchCounter >= batchMax) {
          batchCounter = 0;
          commitCounter++;
          batches[commitCounter] = firestore.batch();
        }
        if (!usedIDs.includes(row.user_pseudo_id)) {
          usedIDs.push(row.user_pseudo_id);
          addUserToPool(createUser(row), batches[commitCounter]);
          insertLocation(row);
          batchCounter++;
        } else {
          doubleCounter++;
        }
      });
      writeToDb(batches);
      console.log('doubleCounter: ' + doubleCounter);
    } catch (err) {
      console.error('ERROR', err);
    }
    removeOldLearnersFromPool();
  }
  fetchUpdatesFromBigQuery();
}

/**
* find all learners in user_pool and move them to unassigned_users
*/
function removeOldLearnersFromPool() {
  const poolRef = firestore.collection('user_pool');
  const oldUsers = firestore.collection('unassigned_users');
  const date = new Date();
  date.setMilliseconds(Date.now() - (DAYINMS * PRUNEDATE));
  const timestamp = makeTimestamp(date.getFullYear().toString() +
    date.getMonth().toString() + date.getDay().toString());
  poolRef.where('dateCreated', '<=', timestamp).get().then((snapshot)=>{
    if (snapshot.empty) {
      return;
    }
    snapshot.forEach((doc)=>{
      const msgRef = oldUsers.doc(doc.id);
      msgRef.set(doc.data(), {merge: true}).then(()=>{
        poolRef.doc(doc.id).delete();
      });
    });
  }).catch((err)=>{
    console.error(err);
  });
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

/**
* add a new location reference to fireStore
* @param{string[]} row the row containing the new location data
*/
function insertLocation(row) {
  if (row.country != null && row.country != '') {
    const locUpdate = {
      region: row.region,
      pin: {
	lat: 0,
	lng: 0,
      },
      learnerCount: 0,
      streetViews: {
        headingValue: [],
        locations: [],
      }};
    const locationRef = firestore.collection('loc_ref').doc(row.country);
    locationRef.get().then((doc)=>{
      if (doc.exists) {
        const regions = doc.data().regions;
        locUpdate.learnerCount = doc.data().learnerCount;
        return regions;
      }
      return [];
    }).then((regions)=>{
      if (regions == undefined || regions.empty) {
        regions = [locUpdate];
      } else {
        for (let i = 0; i< regions.length; i++) {
          if (regions[i].hasOwnProperty('region') &&
            regions[i].region === locUpdate.region) {
            return; // we already have data for this region
          }
        }
        regions.push(locUpdate);
      }
      locationRef.set({
        country: row.country,
        continent: row.continent,
	pin: {
	  lat: 0,
	  lng: 0,
	},
        regions: regions,
      }, {merge: true});
    }).catch((err)=>{
      console.log(err);
    });
  }
}

/**
* Create a user object from a BigQuery row
* @param{string[]} row The array of strings representing a user event
* @return{Object} The newly formatted user object
*/
function createUser(row) {
  if (row.region === null || row.region === undefined || row.region === '') {
    row.region = 'no-region';
  }
  if (row.name === undefined || row.name === null) {
    row.name = 'no-source';
  }
  if (row.country === undefined || row.country === null || row.country === '') {
    row.country = 'no-country';
  }

  const user = {
    userID: row.user_pseudo_id,
    dateCreated: makeTimestamp(row.event_date),
    sourceCampaign: row.name,
    region: row.region,
    country: row.country,
    learnerLevel: row.event_name,
  };
  console.log('created user: ' + user.userID);
  return user;
}

/**
* Convert a date string to a firebase Timestamp
* @param{str} date the date string
* @return{Object} the firebase timestamp
*/
function makeTimestamp(date) {
  const year = date.slice(0, 4);
  const month = date.slice(4, 6);
  const day = date.slice(6);
  const dateString = year.toString()+'-'+month.toString()+'-'+day.toString();
  const parsedDate = new Date(dateString);
  const timestamp = fireStoreAdmin.firestore.Timestamp.fromDate(parsedDate);
  return timestamp;
}

/**
* create and batch a statement to add a new user to the user_pool collection
* @param {Object} user the user Object
* @param {Object} batch the firestore batch to add the set statement to
*/
function addUserToPool(user, batch) {
  const dbRef = firestore.collection('user_pool').doc(user.userID);
  batch.set(dbRef, {
    userID: user.userID,
    dateCreated: user.dateCreated,
    sourceDonor: 'unassigned',
    sourceCampaign: user.sourceCampaign,
    region: user.region,
    country: user.country,
    learnerLevel: user.learnerLevel,
  }, {merge: true});
}
main();
