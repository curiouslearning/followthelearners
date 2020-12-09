const {BigQuery} = require('@google-cloud/bigquery');
const fireStoreAdmin = require('firebase-admin');
const {Client, Status} = require('@googlemaps/google-maps-services-js');
// const firebase = require('firebase/app');
const serviceAccount = require('./keys/firestore-key.json');
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

fireStoreAdmin.initializeApp({
  credential: fireStoreAdmin.credential.cert(serviceAccount),
});
const firestore = fireStoreAdmin.firestore();
const gmaps = new Client({});

/**
* main function
*/
async function main() {
  /**
  * Fetch new users from the last 24 hours
  *
  */
  async function fetchUpdatesFromBigQuery() {
    console.log("updates for ", new Date(Date.now()));
    console.log('============================================================');
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
      let counter = 0;
      let doubleCounter = 0;
      batches[commitCounter] = firestore.batch();
      rows.forEach((row)=>{
        if (batchCounter >= batchMax) {
          batchCounter = 0;
          commitCounter++;
          batches[commitCounter] = firestore.batch();
        }
        if (!usedIDs.includes(row.user_pseudo_id)) {
          counter++;
          usedIDs.push(row.user_pseudo_id);
          addUserToPool(createUser(row), batches[commitCounter]);
          insertLocation(row);
          batchCounter++;
        } else {
          doubleCounter++;
        }
      });
      console.log('created ', counter - doubleCounter, ' new users');
      await writeToDb(batches);
      console.log('doubleCounter: ' + doubleCounter);
    } catch (err) {
      console.error('ERROR', err);
    }
  }
  await fetchUpdatesFromBigQuery();
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
    const locationRef = firestore.collection('loc_ref').doc(row.country);
    locationRef.get().then(async (doc)=>{
      if (!doc.exists) {
        await getPinForAddress(row.country, (markerLoc) => {
          locationRef.set({
            country: row.country,
            continent: row.continent,
            learnerCount: 0,
            pin: {
              lat: markerLoc.lat,
              lng: markerLoc.lng,
            },
            regions: [],
          }, {merge: true});
        });
      } else if (doc.exists && !doc.data().hasOwnProperty('pin') ||
          (doc.exists && doc.data().pin.lat === 0 && doc.data().pin.lng === 0)) {
        await getPinForAddress(row.country, (markerLoc) => {
          locationRef.set({
            pin: {
              lat: markerLoc.lat,
              lng: markerLoc.lng,
            },
          }, {merge: true});
        });
      }
    }).catch((err)=>{
      console.log(err);
    });
  }
}

/**
 * Returns a [lat, lng] pair of values for the given address
 * @param {String} address is the address in string format
 * @param {Function} callback is a function that's called after getting a marker
 */
async function getPinForAddress(address, callback) {
  if (address === 'Georgia') address = 'Country of Georgia';
  await gmaps.geocode({
    params: {
      address: address,
      key: "AIzaSyDEl20cTMsc72W_TasuK5PlWYIgMrzyuAU",
    },
    timeout: 1000, // milliseconds
  }).then((r) => {
    if (r.data.results[0]) {
      // console.log(r.data.results[0]);
      const markerLoc = r.data.results[0].geometry.location;
      callback(markerLoc);
    }
  }).catch((e) => {
    console.log(e.response.data.error_message);
  });
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
  if (row.continent === undefined|| row.country === null || row.country ==='') {
    row.country = 'not-set';
  }

  const user = {
    userID: row.user_pseudo_id,
    dateCreated: makeTimestamp(row.event_date),
    dateIngested: fireStoreAdmin.firestore.Timestamp.now(),
    sourceCampaign: row.name,
    region: row.region,
    country: row.country,
    continent: row.continent,
    learnerLevel: row.event_name,
    userStatus: 'unassigned'
  };
  console.log('created user: ' + user.userID + ' ' + row.country + ' / ' + row.region);
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
    dateIngested: user.dateIngested,
    sourceDonor: 'unassigned',
    sourceCampaign: user.sourceCampaign,
    region: user.region,
    country: user.country,
    continent: user.continent,
    learnerLevel: user.learnerLevel,
    userStatus: user.userStatus,
    countedInMasterCount: false,
    countedInRegion: false,
    countedInCampaign: false,
  }, {merge: true});
}
main();
