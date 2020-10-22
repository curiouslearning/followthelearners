const admin = require('firebase-admin');
const fs = require('fs');
const {BigQuery} = require('@google-cloud/bigquery');
const serviceAccount = require('../keys/firestore-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
const firestore = admin.firestore();

function main() {
  const dbRef = firestore.collection('user_pool')
      .where('country', '==', 'no-country').get().then((snap)=>{
        console.log('size: ', snap.size);
      }).catch((err)=>{
        console.error(err);
      });
}
main();
