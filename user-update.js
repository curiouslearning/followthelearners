const express = require('express');
const http = require('http');
const {BigQuery} = require ('@google-cloud/bigquery');
const fireStoreAdmin = require('firebase-admin');
// const firebase = require('firebase/app');
let serviceAccount = require('./keys/firestore-key.json');
const bodyParser = require('body-parser');
const app = express();
const PRUNEDATE = 5;
const DAYINMS = 86400000;

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
      `ftm-zulu.analytics_155849122.events_*`,
      `ftm-swahili.analytics_160694316.events*`,
      `ftm-english.analytics_152408808.events_*`,
      `ftm-afrikaans.analytics_177200876.events_*`,
      `ftm-australian-english.analytics_159083443.events_*`,
      `ftm-brazilian-portuguese.analytics_161789655.events_*`,
      `ftm-french.analytics_173880465.events_*`,
      `ftm-hausa.analytics_164138311.events_*`,
      `ftm-indian-english.analytics_160227348.events_*`,
      `ftm-isixhosa.analytics_180747962.events_*`,
      `ftm-kinayrwanda.analytics_177922191.events_*`,
      `ftm-ndebele.analytics_181170652.events_*`,
      `ftm-oromo.analytics_167539175.events_*`,
      `ftm-sepedi.analytics_180755978.events_*`,
      `ftm-sesotho.analytics_177536906.events_*`,
      `ftm-siswati.analytics_181021951.events_*`,
      `ftm-somali.analytics_159630038.events_*`,
      `ftm-southafricanenglish.analytics_173750850.events_*`,
      `ftm-spanish.analytics_158656398.events_*`,
      `ftm-tsonga.analytics_177920210.events_*`,
      `ftm-tswana.analytics_181020641.events_*`,
      `ftm-venda.analytics_179631877.events_*`
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
      rows.forEach(row=>{
        if(row.name != null && row.name != undefined && row.name != "" && row.name != '(direct)')
        {
          AddUserToPool(CreateUser(row));
          InsertLocation(row);
        }
      });
    }catch(err){
      console.error('ERROR', err);
    }
    RemoveOldLearnersFromPool();
  }
  FetchUpdatesFromBigQuery();
}

  function RemoveOldLearnersFromPool(){
    let poolRef = firestore.collection('user_pool');
    let oldUsers = firestore.collection('unassigned_users');
    let date = new Date();
    date.setMilliseconds(Date.now() - (DAYINMS * PRUNEDATE));
    let timestamp = MakeTimestamp(date.getFullYear().toString() + date.getMonth().toString() + date.getDay().toString());
    poolRef.where('dateCreated', '<=', timestamp).get().then(snapshot=>{
      if(snapshot.empty){return;}
      snapshot.forEach(doc=>{
        let msgRef = oldUsers.doc(doc.id);
        msgRef.set(doc.data(),{merge:true}).then(()=>{
          poolRef.doc(doc.id).delete();
        });
      });
    }).catch(err=>{console.error(err);});
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
      if(regions == undefined || regions.empty){
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
  if(row.region === null || row.region === undefined || row.region === "")
  {
    row.region = "no-region";
  }

  let user = {
    userID: row.user_pseudo_id,
    dateCreated: MakeTimestamp(row.event_date),
    sourceCampaign: row.name,
    region: row.region,
    country: row.country,
    learnerLevel: row.event_name,
  };
  console.log("created user: " + user.userID);
  return user;
}

function MakeTimestamp(date)
{
  let year = date.slice(0,4);
  let month = date.slice(4,6);
  let day = date.slice(6);
  let dateString = year.toString()+"-"+month.toString()+"-"+day.toString();
  let parsedDate = new Date(dateString);
  let timestamp = fireStoreAdmin.firestore.Timestamp.fromDate(new Date(dateString));
  return timestamp;
}

function AddUserToPool(user)
{
  let dbRef = firestore.collection('user_pool').doc(user.userID);
  dbRef.set({
    userID: user.userID,
    dateCreated: user.dateCreated,
    sourceDonor: "unassigned",
    sourceCampaign: user.sourceCampaign,
    region: user.region,
    country: user.country,
    learnerLevel: user.learnerLevel
  },{merge:true});

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
        country: user.country,
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
