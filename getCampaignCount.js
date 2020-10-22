const admin = require('firebase-admin');
const serviceAccount = require('../keys/firestore-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const firestore = admin.firestore();

const args = process.argv.slice(2);

const campaign = args[0];

function main(campaign) {
  const dbRef = firestore.collection('user_pool');
  dbRef.where('sourceCampaign','==',campaign).get().then((snap)=>{
    console.log(snap.size);
  }).catch((err)=>{console.error(err);});
}
main(campaign);
