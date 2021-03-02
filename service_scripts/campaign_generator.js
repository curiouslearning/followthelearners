//TODO:
// 1. Receive donation object
// 2. Parse object
// 3. Ping BigQuery for existing donor object
//  3a. if no object, create donorID
//  3b. if existing donor, attach donorID
// 4. generate campaign_url [DONE]
// 5. generate CampaignObject.
// 6. Send CampaignObject & url to AdSystem
// 7. Append modified DonorObject to donors.json
// 8. Append CampaignObject to campaigns.json

// donationObject = {
//   "email": "",
//   "lastName": "",
//   "firstName": "",
//   "amount": 0,
//   "regions": ["","",""],
//   "appID" : "",
// }
