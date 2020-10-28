const admin = require('firebase-admin');
const fs = require('fs');
const {BigQuery} = require('@google-cloud/bigquery');
const serviceAccount = require('./keys/firestore-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const firestore = admin.firestore();

const args = process.argv.slice(2);
const country = args[0];
const region = args[1];
function main(country, region) {
  const dbRef = firestore.collection('user_pool');
  if (region === 'all') {
    return dbRef.where('country', '==', country).get().then((snap)=>{
      console.log('size: ', snap.size);
    }).catch((err)=>{
      console.error(err);
    });
  }
  return dbRef.where('country', '==', country)
      .where('region','==', region).get().then((snap)=>{
        console.log('size: ', snap.size);
      }).catch((err)=>{
        console.error(err);
      });
}
main(country, region);
