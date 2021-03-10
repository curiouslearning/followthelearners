const {BigQuery} = require('@google-cloud/bigquery');
const admin = require('firebase-admin');
const {get, isNil} = require('lodash');
const {Client, Status} = require('@googlemaps/google-maps-services-js');
const PRUNEDATE = 7;
const DAYINMS = 86400000;
const HOURINMS = 3600000;
const CONTINENTS = [
  'Africa',
  'Americas',
  'Antarctica',
  'Asia',
  'Europe',
  'Oceania',
];

if (admin.apps.length === 0) {
  admin.initializeApp();
}
const {BatchManager} = require('../helpers/batchManager');
const firestore = admin.firestore();
const gmaps = new Client({});
const countriesAddedOrExist = [];
const Timestamp = admin.firestore.Firestore.Timestamp;

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
      let aggregates = {};
      let counter = 0;
      let doubleCounter = 0;
      for (const row of rows) {
      // If the list of userID's doesn't contain the new user,
      // add it to the list
        if (!usedIDs.includes(row.user)) {
          counter++;
          usedIDs.push(row.user);
          const user = createUser(row);
          addUserToPool(user, batchManager);
          aggregates = countUser(user, aggregates);
          await insertLocation(row);
        } else {
          console.log(`excluding ${row.user}, already counted`);
          doubleCounter++;
        }
      }
      console.log('created ', counter, ' new users');
      console.log('doubleCounter: ' + doubleCounter);
      await batchManager.commit();
      await updateCounts(aggregates);
      console.log('finished updating counts');
    } catch (err) {
      console.error('ERROR', err);
    }
  }
  await fetchUpdatesFromBigQuery();
}

/**
* update all aggregate counts relevant to this user
* @param{Object} user the user being counted
* @param{Object} aggregates the aggregate counts object
* @return{Object} the updated aggregates object
*/
function countUser(user, aggregates) {
  if (!aggregates.master) {
    aggregates['master'] = {
      newLearners: 1,
      dntLearners: 0,
      path: firestore.collection('aggregate_data').doc('data'),
    };
    if (user.country === 'no-country') {
      aggregates.master['dntLearners'] = 1;
    }
    aggregates['campaigns'] = [{
      campaign: user.sourceCampaign,
      newLearners: 1,
      path: firestore.doc(`campaigns/${user.sourceCampaign}`),
    }];
    aggregates['countries'] = [{
      country: user.country,
      newLearners: 1,
      regions: [{
        region: user.region,
        newLearners: 1,
      }],
      path: firestore.doc(`loc_ref/${user.country}`),
    }];
    return aggregates; // early return for first entries
  }

  aggregates.master.newLearners++;
  if (user.country === 'no-country') {
    aggregates.master.dntLearners++;
  }

  const campaignIndex = aggregates.campaigns.findIndex(
      (x)=> x.campaign === user.sourceCampaign
  );
  if (campaignIndex < 0) {
    aggregates.campaigns.push({
      campaign: user.sourceCampaign,
      path: firestore.doc(`campaigns/${user.campaign}`),
      newLearners: 1,
    });
  } else {
    aggregates.campaigns[campaignIndex].newLearners++;
  }

  const countryIndex = aggregates.countries.findIndex(
      (x)=> x.country === user.country
  );
  let country = aggregates.countries[countryIndex];
  if (countryIndex < 0 ) {
    aggregates.countries.push({
      country: user.country,
      newLearners: 1,
      path: firestore.doc(`loc_ref/${user.country}`),
      regions: [{
        region: user.region,
        newLearners: 1,
      }],
    });
  } else if (country.regions.findIndex((x)=> x.region === user.region) < 0) {
    country.newLearners++;
    country.regions.push({
      region: user.region,
      newLearners: 1,
    });
  } else {
    country.newLearners++;
    const region = country.regions.findIndex((x) => x.region === user.region);
    country.regions[region].newLearners++;
  }
  return aggregates;
}

/**
* take the count object and update individual counts
* a document is not updated if it was updated in the last 12 hours, unless
* it was created within the last hour
* @param{Object} counts the object containing the aggregated learner counts
*/
async function updateCounts(counts) {
  // don't update the count if doc has been updated in the last 12 hours
  const updateBuffer = Timestamp.fromDate(new Date(Date.now() - DAYINMS/2));
  await firestore.runTransaction((transaction) => {
    return transaction.get(counts.master.path).then(async (doc) => {
      if ((doc.createTime.toMillis() < (Date.now() - HOURINMS)) &&
        (doc.updateTime >= updateBuffer)) {
        return new Promise((resolve) => {
          resolve('did not update master count');
        });
      }
      console.log(`adding ${counts.master.newLearners} learners to master count`);
      console.log(`adding ${counts.master.dntLearners} learners to dnt count`);
      let data = doc.data();
      data.allLearnersCount += counts.master.newLearners;
      data.allLearnersWithDoNotTrack += counts.master.dntLearners;
      await transaction.set(counts.master.path, data, {merge: true});
      return new Promise((resolve) => {
        resolve('successfully updated master count');
      });
    });
  }).then((res) => {
    console.log(res);
  }).catch((err) => {
    console.error(`unable to update master counts. Encountered error: ${err}`);
  });
  await updateCampaigns(counts.campaigns, updateBuffer).then(() => {
    console.log('successfully updated campaign counts');
  }).catch((err) => {
    console.error(`unable to update campaigns. Encountered error: ${err}`);
  });
  await updateCountries(counts.countries, updateBuffer).then(() => {
    console.log('successfully updated country counts');
  }).catch((err) => {
    console.error(`unable to update countries. Encountered error: ${err}`);
  });
}

/**
* Loop through the campaigns array and update each campaign with the new count
* @param{Array} campaigns an array of the new learner counts for any campaigns
* @param{Firestore.Timestamp} updateBuffer a buffer to prevent multiple updates
* @return{Promise} a promise that resolves if all documents are updated.
*/
 async function updateCampaigns(campaigns, updateBuffer) {
  let paths = [];
  campaigns.forEach((doc) => {
    paths.push(doc.path);
  });
  return firestore.runTransaction((transaction) => {
    return transaction.getAll(...paths).then((docs) => {
      docs.forEach((doc) => {
        if (doc.exists &&
          (doc.createTime.toMillis() >= (Date.now() - HOURINMS) ||
          doc.updateTime < updateBuffer)) {
          let data = doc.data();
          const index = campaigns.findIndex(
              (x) => x.campaign === data.campaignID
          );
          if (index >= 0) {
            const update = campaigns[index];
            console.log(`adding ${update.newLearners} learners to ${data.campaignID}`);
            transaction.update(doc.ref, {
              learnerCount: data.learnerCount + update.newLearners,
            }, {merge: true});
          }
        }
      });
    }).catch((err) => {
      console.error('error updating campaigns');
      console.error(err);
    });
  });
}

/**
* Loop through the countries array and update each document with the new counts
* @param{Object} countries the array of country documents and their counts
* @param{Firestore.Timestamp} updateBuffer buffer to prevent multiple updates
*/
async function updateCountries(countries, updateBuffer) {
  let paths = [];
  countries.forEach((doc) => {
    paths.push(doc.path);
  });

  return firestore.runTransaction((transaction) => {
    return transaction.getAll(...paths).then((docs) => {
      docs.forEach((doc) => {
        if (doc.exists &&
          (doc.createTime.toMillis() >= (Date.now() - HOURINMS) ||
          doc.updateTime < updateBuffer)) {
          let data = doc.data();
          const index = countries.findIndex((x) => x.country === data.country);
          if (index >= 0) {
            const update = countries[index];
            console.log(`adding ${update.newLearners} learners to ${data.country}`);
            update.regions.forEach((region) => {
              let rIndex = -1;
              if (!isNil(data.regions)) {
                rIndex = data.regions.findIndex(
                    (x) => x.region === region.region
                );
              } else {
                data['regions'] = [];
              }
              if (rIndex < 0) {
                data.regions.push({
                  region: region.region,
                  learnerCount: region.newLearners,
                });
              } else {
                let docReg = data.regions[rIndex];
                docReg.learnerCount += region.newLearners;
              }
              console.log(`\tadding ${region.newLearners} to ${region.region}`);
            });
            data.learnerCount += update.newLearners;
          }
          transaction.set(doc.ref, data, {merge: true});
        }
      });
    }).catch((err) => {
      console.error('error updating countries');
      console.error(err);
    });
  });
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
    doc = await locationRef.get();
  } catch(err) {
    console.error(`Error when trying to retrieve the location for country: ${row.country}.  Skipping user: ${row.user_pseudo_id}`);
    return;
  }

  if (doc.exists && !isNil(doc.data().pin) &&
    doc.data().pin.lat !== 0 && doc.data().pin.lng !== 0) {
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
    row.continent = 'no-continent';
    if (isNil(row.country) || row.country == '') {
      row.country = 'no-country';
    }
  }
  if (isNil(row.name) || row.name === '') {
    row.name = 'no-campaign';
  }

  const user = {
    userID: row.user,
    dateCreated: makeTimestamp(row.event_date),
    dateIngested: admin.firestore.Timestamp.now(),
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
  return admin.firestore.Timestamp.fromDate(parsedDate);
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
