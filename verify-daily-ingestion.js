const admin = require('firebase-admin');
if (admin.apps.length === 0) {
  admin.initializeApp();
}
const DAYINMS = 86400000;
const interval = 1;
const firestore = admin.firestore();
const Timestamp = admin.firestore.Firestore.Timestamp;

(async() => {await main();})();

async function main() {
  const rawDate = new Date(Date.now() - (DAYINMS * (1 + interval)));
  const min = new Date(rawDate);
  min.setHours(0, 0, 0, 0);
  const max = new Date(rawDate);
  max.setHours(23, 59, 59, 999);
  console.log(`Date: ${rawDate.toISOString().slice(0, 10)}`);
  console.log(`min: ${min.toISOString()}`);
  console.log(`max: ${max.toISOString()}`);
  const dbRef = firestore.collection('user_pool');
  await dbRef.where('dateCreated', '>=', Timestamp.fromDate(min))
      .where('dateCreated', '<=', Timestamp.fromDate(max))
      .get().then((snap) => {
        console.log(`found ${snap.size} learners`);
      });
}
