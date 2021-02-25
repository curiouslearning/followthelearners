const admin = require('firebase-admin');
const fs = require('fs');
const {BigQuery} = require('@google-cloud/bigquery');
admin.initializeApp();
const firestore = admin.firestore();
const Timestamp = admin.firestore.Firestore.Timestamp;
const PRUNEDATE = 7;
const DAYINMS = 86400000;
const CONTINENTS = [
  'Africa',
  'Americas',
  'Antarctica',
  'Asia',
  'Europe',
  'Oceania',
];

(async () => {await main();})();
async function main() {
  const dateString = getDateString(new Date(Date.now()));
  const dbRef = firestore.collectionGroup('donations');
  const query = dbRef.where('percentFilled', '<', 100);
  query.get().then((snap) => {
    let data = '';
    if (snap.empty) {
      console.error('no records found!');
      return;
    }
    snap.forEach((doc) => {
      const docFields = doc.data();
      docFields['date'] = dateString;
      const startDate = new Date(docFields.startDate.toMillis());
      docFields.startDate = getDateString(startDate);
      delete docFields.countries;
      delete docFields.stripeEventId;
      const row = JSON.stringify(docFields);
      data += row+ '\n';
    });
    const filename = 'unfilled-donations-' + dateString + '.json';
    fs.writeFileSync(filename, data, (err) => {
      if (err) throw err;
      console.log('Successfully wrote file');
    });
    return loadIntoBigQuery(filename);
  });
}

function getDateString (date) {
  const year = date.getFullYear().toString();
  const month = (date.getMonth() + 1).toString();
  const day = date.getDate().toString();
  return `${year}-${month}-${day}`;
}

async function loadIntoBigQuery(filename) {
  const bigQueryClient = new BigQuery();
  const dataset = bigQueryClient.dataset('ftl_dataset');
  const table = dataset.table('unfilled_donations');
  const metadata = {
    encoding: 'UTF-8',
    createDisposition: 'CREATE_IF_NEEDED',
    writeDisposition: 'WRITE_APPEND',
    sourceFormat: 'NEWLINE_DELIMITED_JSON',
    schemaUpdateOption: 'ALLOW_FIELD_ADDITION',
    destinationTable: table,
  };
  await table.load('./' + filename, metadata, (err, res) => {
    if (err) throw err;
    console.log('Successfully uploaded to BigQuery');
  });
}
