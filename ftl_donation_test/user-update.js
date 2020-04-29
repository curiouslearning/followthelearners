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
      `ftm-hindi.analytics_174638281.events_*`
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
        let parseSource = (row)=>{
          if (row.name != null) {
            if(row.name.includes('_'))
            {
              let parsedName = row.name.split('_');
              return {donorID: parsedName[1], campaignID: parsedName[2]};
            }
            return {donorID: "CuriousLearning", campaignID: row.name};
          } else {
            return {donorID: "CuriousLearning", campaignID: "(default)"};
        }};
        let source = parseSource(row);
        console.log(source);

        //parse traffic_source.name and get campaignID and source donor
        let userRef = db.doc(source.donorID).collection('donations').doc(source.campaignID).collection('users').doc(row.user_pseudo_id);
        userRef.set({
          userID: row.user_pseudo_id,
          dateCreated: row.event_date,
          sourceDonor: source.donorID,
          sourceCampaign: source.campaignID,
          region: [row.region],
          learnerLevel: row.event_name,
        },{merge:true});
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
      });
    }catch(err){
      console.error('ERROR', err);
    }
  }
  FetchUpdatesFromBigQuery();
}

function getCampaignSourceDonor(donorID, result)
{
  let donors = firestore.collection('donor_master');
  return donors.where("donorID", "==", donorID).get().then(snapshot=>{
        result(snapshot);
      });
}
main();
