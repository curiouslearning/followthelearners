const functions = require('firebase-functions');

const admin = require('firebase-admin');

admin.initializeApp();


exports.updateRegion = functions.firestore.document('/user_pool/{documentId}')
  .onCreate((snap, context)=>{
    const country = snap.data().country;
    const region = snap.data().region;
    console.log(country, region);
    return updateCountForRegion(country, region).then(sum=>{
      let docRef = admin.firestore().collection('loc_ref').doc(country);
      return docRef.get().then(doc=>{
        let regions = doc.data().regions;
        let countrySum = 0;
        for (let i=0; i < regions.length; i++){
          if(regions[i].region == region){
            regions[i].learnerCount = sum;
          }
          countrySum += regions[i].learnerCount;
        }
        return {regions: regions, countrySum: countrySum};
      }).then(values=>{
        return docRef.set({
          regions: values.regions,
          learnerCount: values.countrySum
        }, {merge: true});
      }).catch(err=>{console.error(err);});
    }).catch(err=>{console.error(err);});
  });

exports.addCountryToSummary = functions.firestore.document('loc_ref/{documentId}')
  .onCreate((snap, context)=>{
    const country = snap.data().country;
    let regions = snap.data().regions;
    let regionCounts = [];
    regions.forEach(region=>{
      regionCounts.push({
        region: region.region,
        learnerCount: region.learnerCount
      });
    });
    let summary = admin.firestore().collection('aggregate_data').doc('RegionSummary');
    return summary.get().then(doc=>{
      let countries = doc.data().countries;
      countries.push({
        country: country,
        regions: regionCounts
      });
      return countries;
    }).then(countries=>{
      return summary.update({countries: countries});
    }).catch(err=>{console.error(err);});
  });

exports.updateSummary = functions.firestore.document('/loc_ref/{documentId}')
  .onUpdate(async (change, context)=>{
    const country = change.after.id;
    if(change.after.id === '_RegionSummary')
    {
      return;
    }
    const originalValue = change.after.data().regions;
    let summary = await admin.firestore().collection('aggregate_data').doc('RegionSummary').get().catch(err=>{console.error(err);});
    let sums = summary.data().countries;
    const countryIndex = findCountryIndex(sums, country);
    console.log("country index is " + countryIndex);
    if(countryIndex != undefined){
      sums[countryIndex].regions = originalValue;
    }
    return admin.firestore().collection('aggregate_data').doc('RegionSummary').update({countries: sums}, {merge: true});
  });

  exports.updateDonationLearnerCount = functions.firestore
    .document('donor_master/{donorId}/donations/{donationId}/users/{documentId}')
    .onCreate((snap, context)=>{
      let dbRef = admin.firestore().collection('donor_master')
        .doc(context.params.donorId).collection('donations')
        .doc(context.params.donationId);
      console.log("found new user: " + snap.id);
      return dbRef.collection('users').get().then(snapshot=>{
        if(snapshot.empty)
        {
          return 0;
        }
        return snapshot.size;
      }).then(sum=>{
        dbRef.update({learnerCount: sum},{merge: true});
      }).catch(err=>{console.error(err);});
    });

    exports.registerDeletedLearner = functions.firestore
      .document('donor_master/{donorId}/donations/{donationId}/users/{documentId}')
      .onDelete((snap, context)=>{
        let dbRef = admin.firestore().collection('donor_master')
          .doc(context.params.donorId).collection('donations')
          .doc(context.params.donationId);
        console.log("deleted user: " + snap.id);
        return dbRef.collection('users').get().then(snapshot=>{
          if(snapshot.empty)
          {
            return 0;
          }
          return snapshot.size;
        }).then(sum=>{
          dbRef.update({learnerCount: sum},{merge: true});
        }).catch(err=>{console.error(err);});
      });

    exports.updateCampaignLearnerCount = functions.firestore
      .document('donor_master/{donorId}/donations/{donationId}')
      .onUpdate((change, context)=>{
        if(change.before.data().learnerCount === change.after.data().learnerCount)
        {
          return;
        }
        const campaignId = change.after.data().campaignID;
        return updateCountForCampaign(campaignId);
    });

    exports.addNewLearnersToCampaign = functions.firestore
      .document('user_pool/{documentId}')
      .onCreate((snap, context)=>{
        let campaignID = snap.data().sourceCampaign;
        return updateCountForCampaign(campaignID);
      });

  function updateCountForCampaign(campaignID)
  {
    console.log('searching for campaign ', campaignID);
    let id ="";
    let sum = 0;
    let dbRef = admin.firestore().collection('campaigns');
    return dbRef.where('campaignID', '==', campaignID).get().then(snapshot=>{
      if(snapshot.empty){
        return;
      }
      return snapshot.docs[0];
    }).then(doc=>{
      if(doc === undefined){
        return;
      }
      id = doc.id;
      console.log("found campaign with id " + id);
      return admin.firestore().collectionGroup('donations').where('campaignID','==', campaignID).get().then(snapshot=>{
        if(snapshot.empty){
          sum = 0;
        }
        else{
          snapshot.forEach(doc=>{
            if(doc.data().learnerCount != undefined){
              sum += doc.data().learnerCount;
            }
          });
        }
        console.log("sum is: " + sum);
      }).catch(err=>{console.error(err);});
    }).then(()=>{
      let poolRef = admin.firestore().collection('user_pool');
      return poolRef.where('sourceCampaign', '==', campaignID)
        .get().then(snapshot=>{
          sum += snapshot.size;
        }).catch(err=>{console.error(err);});
    }).then(()=>{
      let unassignedRef = admin.firestore().collection('unassigned_users');
      return unassignedRef.where('sourceCampaign', '==', campaignID)
        .get().then(snapshot=>{
          sum += snapshot.size;
        }).catch(err=>{console.error(err);});
    }).then(()=>{
      if(id != ""){
        let msgRef = admin.firestore().collection('campaigns').doc(id);
        msgRef.update({learnerCount: sum}, {merge: true});
      }
    }).catch(err=>{console.error(err);});
  }

  function updateCountForRegion(country, region)
  {
    console.log(country, region);
    if(country === undefined) {return;}
    if(region === undefined){region = "no-region";}
    let dbRef = admin.firestore().collectionGroup('users');
    return dbRef.where('country', '==', country).where('region','==',region)
      .get().then(snapshot=>{
        return snapshot.size;
      }).then(subtotal=>{
        let poolRef = admin.firestore().collection('user_pool');
        return poolRef.where('country', '==', country).where('region', '==', region)
          .get().then(snapshot=>{
            subtotal += snapshot.size;
            return subtotal;
          }).catch(err => {console.error(err);});
      }).then(subtotal=>{
        let unassignedRef = admin.firestore().collection('unassigned_users');
        return unassignedRef.where('country','==',country).where('region','==',region)
        .get().then(snapshot=>{
          subtotal += snapshot.size;
          return subtotal;
        }).catch(err=>{console.error(err);});
      }).catch(err=>{console.error(err);});
  }

  function findCountryIndex(arr, country)
  {
    for(let i=0; i < arr.length; i++)
    {
      if(arr[i].country === country)
      {
        return i
      }
    }
    return undefined;
  }
