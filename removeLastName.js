const admin = require('firebase-admin');
const serviceAccount = require('./keys/firestore-key.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const { BatchManager } =  require('./batchManager');
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;
const dbRef = db.collection('donor_master');
const manager = new BatchManager();

function main() {
  dbRef.get().then((snap) => {
    snap.forEach((doc) => {
      const data = doc.data();
      if (data.lastName) {
        const id = doc.id;
        manager.update(dbRef.doc(id), {
          lastName: FieldValue.delete(),
        });
      }
    });
    manager.commit();
  }).catch((err) => {
    console.error(err);
  });
}
main();
