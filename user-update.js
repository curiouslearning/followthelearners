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

function main() {
  async function FetchUpdatesFromBigQuery(){
    const bigQueryClient = new BigQuery();
    let db = firestore.collection('donor_master');
    let tables =[
      `ftm-brazilian-portuguese.analytics_161789655.events_*`,
      `ftm-hindi.analytics_174638281.events_*`,
      `ftm-swahili.analytics_160694316.events*`
    ];
    let query = ""
    tables.forEach(table=>{
      if(query != ""){
        query = query.concat(" UNION ALL ");
      }
      let subquery = `SELECT DISTINCT user_pseudo_id, event_name, event_date, traffic_source.name, geo.continent, geo.country, geo.region FROM \``+ table+`\` WHERE _TABLE_SUFFIX = FORMAT_DATE('%Y%m%d', DATE_SUB(CURRENT_DATE(), INTERVAL 1 DAY)) AND event_name = \"first_open\"`;
      query = query.concat(subquery);
    });

    console.log("query is: ", query);
    const options = {
      query: query,
      location: 'US',
    };

    try{
      const [rows] = await bigQueryClient.query(options);
      console.log("successful Query");
      let campaigns = {};
      rows.forEach(row=>{
        if(row.name != null && row.name != undefined && row.name != "" && row.name != '(direct)')
        {
          if(!campaigns.hasOwnProperty(row.name)){
            campaigns[row.name] = {users: []};
          }
          campaigns[row.name].users.push(CreateUser(row))
          InsertLocation(row);
        }
      });
      for (property in campaigns){
        let dbRef = firestore.collectionGroup('donations');
        let donors = {};
        let totalSpend = 0;
        dbRef.where('campaignID', '==', property).get().then(snapshot=>{
          if(snapshot.empty) {}
          snapshot.forEach(doc=>{
            let data = doc.data();
            totalSpend += data.amount;
            if (!donors.hasOwnProperty(data.sourceDonor)){
              donors[data.sourceDonor]= {amount: data.amount};
            }else{
              donors[data.sourceDonor].amount += data.amount;
            }
          });
          for (donor in donors) {
            let contributionFraction = donors[donor].amount/totalSpend;
            let usersForDonor = campaigns[property].users.length * contributionFraction;
            let userList = [];
            let count = 0;
            while (count <= usersForDonor)
            {
              userList.push(campaigns[property].users[0]);
              campaigns[property].users.shift();
              count++;
            }
            InsertUsers(donor, userList);
          }
        }).catch(err=>{console.error(err);});
      }
    }catch(err){
      console.error('ERROR', err);
    }
  }
  FetchUpdatesFromBigQuery();
}


function InsertLocation(row)
{
  if(row.country != null && row.country != ""){
    let locationRef = firestore.collection("loc_ref").doc(row.country);
    locationRef.get().then(doc=>{
      if(doc.exists){
        let regions = doc.data().regions;
        return regions;
      }
      return [];
    }).then(regions=>{
      if(regions.empty){
        regions = [row.region];
      }
      else if(!regions.includes(row.region)){
        regions.push(row.region);
      }
      locationRef.set({
        country: row.country,
        continent: row.continent,
        regions: regions,
      },{merge: true});
    }).catch(err=>{
      console.log(err);
    });
  }
}

function CreateUser (row)
{
  let user = {
    userID: row.user_pseudo_id,
    dateCreated: row.event_date,
    sourceCampaign: row.name,
    region: row.region,
    learnerLevel: row.event_name,
  };
  return user;
}

function InsertUsers (donor, userList)
{
  let donorRef = firestore.collection('donor_master').doc(donor);
  userList.forEach(user => {
    if(user != undefined){
      console.log("User: ", user.userID);
      let userRef = donorRef.collection('donations').doc(user.sourceCampaign).collection('users').doc(user.userID);
      userRef.set({
        userID: user.userID,
        dateCreated: user.dateCreated,
        sourceDonor: donor,
        sourceCampaign: user.sourceCampaign,
        region: user.region,
        learnerLevel: user.learnerLevel
      },{merge:true});
    }
  });
}

function getCampaignSourceDonor(donorID, result)
{
  let donors = firestore.collection('donor_master');
  return donors.where("donorID", "==", donorID).get().then(snapshot=>{
        result(snapshot);
      });
}
main();
