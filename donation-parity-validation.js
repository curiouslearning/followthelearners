const {apiKey} = require('../keys/stripe.json')
const stripe = require('stripe')(apiKey);
const serviceAccount = require('../keys/firestore-key.json');
const fireStoreAdmin = require('firebase-admin');

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
            eventId: donation.id,
            amount: donation.amount,
            createdOn: new Date(donation.created * 1000)
        });
    })
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
            eventId: donation.data().stripeEventId,
            amount: donation.data().amount,
            createdOn: new Date(donationDocs[0].data().startDate._seconds*1000),
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
    for (let stripeDonation of stripeDonations) {
        let correspondingFirebaseDonation = firebaseDonations.find(fbDonation =>
            fbDonation.eventId.replace('evt_', '') === stripeDonation.eventId.replace('ch_'));

        totalStripeDonations += stripeDonation.amount;

        if(!correspondingFirebaseDonation) {
            missingStripeDonations.push(stripeDonation);
            continue;
        }

        firebaseDonations.splice(firebaseDonations.findIndex(fbd => fbd.id === correspondingFirebaseDonation.id), 1);

        totalFirebaseDonations += correspondingFirebaseDonation.amount;
    }

    //TODO finish the parity checks and return the results to the caller or log to a file
    console.log(firebaseDonations);
})();





