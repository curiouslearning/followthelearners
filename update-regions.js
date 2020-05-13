const http = require('http');
const fireStoreAdmin = require('firebase-admin');
let serviceAccount = require('./keys/firestore-key.json');
const bodyParser = require('body-parser');
let countries = require('./regions.json');

fireStoreAdmin.initializeApp({
    credential: fireStoreAdmin.credential.cert(serviceAccount)
  });
let api = fireStoreAdmin.firestore;
let firestore = fireStoreAdmin.firestore();

function main() {
  countries.forEach((country, i)=>{
    let messageRef = firestore.collection("loc_ref").doc(country.country);
    country.regions.forEach(region=>{
      region.streetViews.locations.forEach(function (location, i) {
        this[i] = new api.GeoPoint(location.lat, location.lng);
        console .log("location: ", this[i]);
      }, region.streetViews.locations);
        console.log('region streetview: ', region.streetViews.locations[0]);
    });
      messageRef.set({
        'regions': country.regions
      },{merge: true});
  });
}
main();
