const http = require('http');
const fireStoreAdmin = require('firebase-admin');
let serviceAccount = require('./keys/firestore-key.json');
const bodyParser = require('body-parser');
let factList = require('./country-facts.json');

fireStoreAdmin.initializeApp({
  credential: fireStoreAdmin.credential.cert(serviceAccount)
});

let firestore = fireStoreAdmin.firestore();

function main()
{
  let dbRef = firestore.collection('loc_ref');
  factList.countries.forEach(country=>{
    let messageRef = dbRef.doc(country.country);
    messageRef.set({
      facts: country.facts
    }, {merge: true});
  });

}
main();
