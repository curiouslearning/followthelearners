const {BigQuery} = require('@google-cloud/bigquery');
const fireStoreAdmin = require('firebase-admin');
const {Client} = require('@googlemaps/google-maps-services-js');
const {BatchManager} = require('./batchManager');
const {get, isNil} = require('lodash');

if (fireStoreAdmin.apps.length === 0) {
  fireStoreAdmin.initializeApp();
}
const firestore = fireStoreAdmin.firestore();
const gmaps = new Client({});
const countriesAddedOrExist = [];

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
    const query = 'SELECT * FROM `follow-the-learners.ftl_dataset.daily_new_users` WHERE event_date = FORMAT_DATE("%Y%m%d", DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY))'

    const options = {
      query: query,
      location: 'US',
    };

    try {
      const rows = await bigQueryClient.createQueryJob(options).then((data) => {
        const job = data[0];
        return job.getQueryResults();
      }).then((res) => {
        return res[0];
      }).catch((err) => {
        throw err;
      });
      console.log(`successful Query - retrieved ${rows.length} new users`);
      let batchManager = new BatchManager();
      let usedIDs = [];
      let counter = 0;
      let doubleCounter = 0;
      for (const row of rows) {
      // If the list of userID's doesn't contain the new user,
      // add it to the list
        if (!usedIDs.includes(row.user)) {
          counter++;
          usedIDs.push(row.user);
          addUserToPool(createUser(row), batchManager);
          await insertLocation(row);
        } else {
          console.log(`excluding ${row.user}, already counted`);
          doubleCounter++;
        }
      }

      console.log('created ', counter, ' new users');
      await batchManager.commit();
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
  for(const [index, a] of arr.entries()) {
    console.log(`writing batch: ${index}`);
    try {
      await a.commit();
    } catch(err) {
      console.error(err);
    }
    console.log(`wrote batch: ${index}`);
    await waitForSecond();
  }
}

/**
* add a new location reference to fireStore if not exists
* @param{string[]} row the row containing the new location data
*/
async function insertLocation(row) {
  if(isNil(row.country) || row.country === '' || countriesAddedOrExist.includes(row.country)) return;

  let doc, locationRef;
  try {
    locationRef = firestore.collection('loc_ref').doc(row.country);
    doc = locationRef.get();
  } catch(err) {
    console.error(`Error when trying to retrieve the location for country: ${row.country}.  Skipping user: ${row.user_pseudo_id}`);
    return;
  }

  if(doc.exists && doc.data().pin.lat !== 0 && doc.data().pin.lng !== 0) {
    countriesAddedOrExist.push(row.country);
    return;
  }

  if (!doc.exists) {
    const markerLoc = await getPinForAddress(row.country);
    if(!markerLoc) {
      console.error(`Unable to retrieve a Google pin for address: ${row.country}.  Skipping user: ${row.user_pseudo_id}`);
      return;
    }

    await locationRef.set({
      country: row.country,
      continent: row.continent,
      learnerCount: 0,
      pin: {
        lat: markerLoc.lat,
        lng: markerLoc.lng,
      },
      regions: [],
      }, {merge: true});
    countriesAddedOrExist.push(row.country);
  } else if (doc.exists && !doc.data().hasOwnProperty('pin') ||
        (doc.exists && doc.data().pin.lat === 0 && doc.data().pin.lng === 0)) {
    const markerLoc = await getPinForAddress(row.country);

    if(!markerLoc) {
      console.error(`Unable to retrieve a Google pin for address: ${row.country}.  Skipping user: ${row.user_pseudo_id}`);
      return;
    }

    await locationRef.set({
      pin: {
        lat: markerLoc.lat,
        lng: markerLoc.lng,
      },
    }, {merge: true});
    countriesAddedOrExist.push(row.country);
  }
}

/**
 * Returns a [lat, lng] pair of values for the given address
 * @param {String} address is the address in string format
 */
async function getPinForAddress(address) {
  if (address === 'Georgia') address = 'Country of Georgia';

  try {
    const r = await gmaps.geocode({
      params: {
        address: address,
        key: "AIzaSyDEl20cTMsc72W_TasuK5PlWYIgMrzyuAU",
      },
      timeout: 1000, // milliseconds
    });
    return get(r, 'data.results[0]') ? r.data.results[0].geometry.location : null;
  } catch(err) {
    console.log(get(err, 'response.data.error_message', err));
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
  if (isNil(row.continent) || row.continent === '') {
    row.continent = 'not-set';
    if (isNil(row.country) || row.country == '') {
      row.country = 'not-set';
    }
  }

  const user = {
    userID: row.user,
    dateCreated: makeTimestamp(row.event_date),
    dateIngested: fireStoreAdmin.firestore.Timestamp.now(),
    sourceCampaign: row.name,
    region: row.region,
    country: row.country,
    continent: row.continent,
    learnerLevel: row.event_name,
    userStatus: 'unassigned'
  };
  // console.log('created user: ' + user.userID + ' ' + row.country + ' / ' + row.region);
  return user;
}

/**
* Convert a date string to a firebase Timestamp
* @param date the date string
* @return{Object} the firebase timestamp
*/
function makeTimestamp(date) {
  const year = date.slice(0, 4);
  const month = date.slice(4, 6);
  const day = date.slice(6);
  const dateString = year.toString()+'-'+month.toString()+'-'+day.toString();
  const parsedDate = new Date(dateString);
  return fireStoreAdmin.firestore.Timestamp.fromDate(parsedDate);
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
  }, true);
}
(async ()=> {await main();})();
