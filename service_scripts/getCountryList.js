const admin = require('firebase-admin');
const config = require('./keys/firestore-key.json');
const helpers = require('../ftl-functions/functions/helpers/firebaseHelpers');
admin.initializeApp({});
const firestore = admin.firestore();

function main () {
  const dbRef = firestore.collection('user_pool');
  dbRef.get().then((snap) => {
    let size = snap.size;
    let countries = [];
    snap.forEach((doc) => {
      const data = doc.data();
      const index = helpers.findObjWithProperty(countries, 'country', data.country);
      if (index < 0) {
        countries.push({country: data.country, count: 1});
      } else {
        countries[index].count++;
      }
    });
    let sum = 0;
    for (country in countries) {
      if (countries[country]) {
        const name = countries[country].country;
        const count = countries[country].count;
        console.log(`${name}: ${count}`);
        sum += count;
      }
    }
    console.log(`size: ${size}`);
    console.log(`count: ${sum}`);
  });
}

main();
