const {apiKey} = require('./keys/stripe.json')
const stripe = require('stripe')(apiKey);
const serviceAccount = require('./keys/firestore-key.json');
const fireStoreAdmin = require('firebase-admin');
const get = require('lodash/get');

fireStoreAdmin.initializeApp({
    credential: fireStoreAdmin.credential.cert(serviceAccount)
});

const firestore = fireStoreAdmin.firestore();
const numberOfRecordsToRead = 20;

const listStripeCharges = async () => {
    const charges = await stripe.charges.list({
        limit: numberOfRecordsToRead,
    });

    if((charges.data||[]).length < 1) {
        throw new Error('Unable to retrieve donations from Stripe');
    }

    const formattedDonations = [];

    //TODO take into account refunded/failed payments
    charges.data.forEach(donation => {
        formattedDonations.push({
            chargeId: donation.id,
            amount: donation.amount,
            createdOn: new Date(donation.created * 1000)
        });
    });
    return formattedDonations;
}

const listFirebaseDonations = async () => {
    const donations = await firestore.collectionGroup('donations').orderBy('startDate', 'desc')
        .limit(numberOfRecordsToRead).get();
    if(donations.empty) {
        throw new Error('Unable to retrieve donations from Firebase');
    }

    const formattedDonations = [];
    const donationDocs = donations.docs;

    //TODO take into account refunded/failed payments
    donationDocs.forEach(donation => {
        formattedDonations.push({
            donationId: donation.data().donationID,
            chargeId: donation.data().chargeId,
            amount: donation.data().amount,
            createdOn: new Date((donation.data().startDate._seconds*1000)),
        });
    })
    return formattedDonations;
}

(async () => {
    let donationResults;
    try {
        donationResults = await Promise.all([listFirebaseDonations(), listStripeCharges()])
    } catch(err) {
        console.error(`Error when trying to pull donation information - ${err.msg || err.message}`, err);
        //TODO return a 500 response
    }
    const firebaseDonations = donationResults[0];
    const stripeDonations = donationResults[1];

    const donationEventsOutsideOfStripe = [];
    const missingStripeDonations = [];
    let totalStripeDonations = 0;
    let totalFirebaseDonations = 0;

    //Use stripe as the source of truth
    for (const stripeDonation of stripeDonations) {
        let correspondingFirebaseDonation = firebaseDonations.find(fbDonation =>
            fbDonation.chargeId === stripeDonation.chargeId);

        totalStripeDonations += stripeDonation.amount;

        if(!correspondingFirebaseDonation) {
            missingStripeDonations.push(stripeDonation);
            continue;
        }

        firebaseDonations.splice(firebaseDonations.findIndex(fbd => fbd.id === correspondingFirebaseDonation.id), 1);

        totalFirebaseDonations += correspondingFirebaseDonation.amount;
    }

    if(firebaseDonations.length > 0) {
        console.warn(`There are ${firebaseDonations.length} donation(s) that are in the Firebase DB that are not ` +
    `present in Stripe.  This is most likely due to testing data.  Donation ID's are:
    ${firebaseDonations.map(d => `id: ${d.donationId || 'unknown donationID!'}, amount: $${d.amount}`).join('\n\t')}`);
    }

    //TODO finish the parity checks and return the results to the caller or log to a file
    console.log(firebaseDonations);
})();





