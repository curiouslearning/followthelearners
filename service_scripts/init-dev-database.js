const admin = require('firebase-admin');
const {get, isNil} = require('lodash');
if (admin.apps.length === 0) {
  admin.initializeApp();
}
const firestore = admin.firestore();
const Timestamp = admin.firestore.Firestore.Timestamp;
const CPL = 1;
const DAYINMS = 86400000;

(async () => {await main();})();

async function main() {
  console.log(process.env.FIRESTORE_EMULATOR_HOST);
  if (process.env.FIRESTORE_EMULATOR_HOST !== 'localhost:8080') {
    return; // DO NOT AFFECT PRODUCTION
  }
  await firestore.collection('aggregate_data').doc('data').set({
    allLearnersCount: 0,
    allLearnersWithDoNotTrack: 0,
  }).then((doc)=> {
    console.log('created aggregate data doc');
  }).catch((err) => {
    console.error('error creating aggregate data collection');
    console.error(err);
  });

  await firestore.collection('campaigns').doc('Africa').set({
    campaignID: 'Africa',
    country: 'any',
    costPerLearner: CPL,
    isActive: true,
    isVisible: true,
    isFeatured: true,
    learnerCount: 0,
    createdAt: Timestamp.fromDate(new Date(Date.now())),
    summary: '<p>&nbsp;&nbsp;&nbsp;According to recent UNESCO statistics, of all regions in the world, sub-Saharan Africa has the highest rates of education exclusion. Over one-fifth of children between the ages of about 6 and 11 are out of school. As of 2019, 385 million individuals ages 15 and older are illiterate in sub-Saharan Africa. </p>  <p><br />&nbsp;&nbsp;&nbsp;Donating to this campaign will reach learners across all countries in Africa. </p> <p><br /><small>  Photo Credit: Tinsley Galyean </small></p>',
    donateRef: 'https://secure.givelively.org/donate/curious-learning-a-global-literacy-project-inc/follow-the-learners-africa',
    imageRef: 'https://static1.squarespace.com/static/57ac8d30d1758ee63faab8a7/t/5f88c3bdffdf5d53413d2088/1602798538998/africa_placeholder.png?format=1000w',
  }).then((doc) => {
    console.log('created campaigns collection');
  }).catch((err) => {
    console.error('error creating campaigns collection');
    console.error(err);
  });

  await firestore.collection('loc_ref').doc('no-country').set({
    learnerCount: 0,
    continent: 'no-continent',
    country: 'no-country',
    facts: [],
  }).then((doc) => {
    console.log('initialized location reference');
  }).catch((err) => {
    console.error('error initializing location reference');
    console.error(err);
  });

  await firestore.collection('donor_master').doc('initial-donor').set({
    donorID: 'initial-donor',
    name: 'test',
    email: 'fake@test.donor',
    createdAt: Timestamp.fromDate(new Date(Date.now())),
  }).then((doc) => {
    return firestore.collection('donor_master').doc('initial-donor')
        .collection('donations').doc('initial-donation').set({
          donationID: 'initial-donation',
          sourceDonor: 'initial-donor',
          startDate: Timestamp.fromDate(new Date(Date.now())),
          learnerCount: 0,
          amount: 20,
          costPerLearner: CPL,
          campaignID: 'Africa',
          percentFilled: 0,
          frequency: 'one-time',
        }).then((doc) => {
          console.log('successfully initialized donors collection');
        }).catch((err) => {
          console.error('error initializing donor collection');
          console.error('err');
        });
  }).catch((err) => {
    console.error('error initializing donor collection');
    console.error('err');
  });

  await firestore.collection('user_pool').doc('initial_user').set({
    userID: 'initial_user',
    continent: 'Africa',
    country: 'South Africa',
    region: 'Gauteng',
    createdAt: Timestamp.fromDate(new Date(Date.now())),
    ingestedAt: Timestamp.fromDate(new Date(Date.now())),
    sourceDonor: 'unassigned',
    userStatus: 'unassigned',
    sourceCampaign: '(direct)',
  }).then((doc) => {
    console.log('successfully initialize user pool');
  }).catch((err) => {
    console.error('error initializing user pool');
    console.error(err);
  });
}
