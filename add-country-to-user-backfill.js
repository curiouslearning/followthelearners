const express = require('express');
const http = require('http');
const {BigQuery} = require ('@google-cloud/bigquery');
const fireStoreAdmin = require('firebase-admin');
let serviceAccount = require('./keys/firestore-key.json');
const bodyParser = require('body-parser');
const app = express();

fireStoreAdmin.initializeApp({
    credential: fireStoreAdmin.credential.cert(serviceAccount)
  });
let firestore = fireStoreAdmin.firestore();

function main () {
  let dbRef = firestore.collectionGroup('users');
  dbRef.get().then(snapshot=>{
    if(snapshot.empty){
      console.log("could not access users!");
      return;
    }
    snapshot.forEach((doc) => {
      let data = doc.data();
      let donorRef = firestore.collection('donor_master').doc(data.sourceDonor);
      let campaignRef = donorRef.collection('donations').doc(data.sourceCampaign);
      let user = campaignRef.collection('users').doc(doc.id);
      campaignRef.get().then(campaign=>{
        if(campaign === undefined) {return;}
        let campaignData = campaign.data();
        if(campaignData === undefined || campaignData.region === undefined) {return};
        user.update({
            country: campaign.data().region
        });
      });
    });
  }).catch(err=>{console.log(err);});
}
main();
