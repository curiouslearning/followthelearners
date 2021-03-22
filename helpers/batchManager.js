const admin = require('firebase-admin');
if (admin.apps.length === 0) {
  admin.initializeApp();
}
const firestore = admin.firestore();

const BATCHMAX = 495;

/**
 * Class to automate large batched writes to Firestore
 */
class BatchManager {
  /**
   * Initialize one batch in the batches array and set max batchSize
   */
  constructor() {
    this.TIMEOUT = 1050;
    this.BATCHMAX = 495;
    this.batchSize = 0;
    this.batchCount = 0;
    this.batches = [];
    this.batches[this.batchCount] = firestore.batch();
  }

  /**
  * Increment the batch size, and switch to a new batch if necessary
  * called internally
  */
  updateBatch() {
    this.batchSize++;
    if (this.batchSize >= 495) {
      this.batchSize = 0;
      this.batchCount++;
      this.batches[this.batchCount] = firestore.batch();
    }
  }

  /**
  * set a document at the described path to contain the given data
  * @param{DocumentReference} docRef the document to edit or create
  * @param{Object} data the data to write to the document described by docRef
  * @param{bool} shouldMerge should unmodified data be preserved
  */
  set(docRef, data, shouldMerge) {
    this.batches[this.batchCount].set(docRef, data, {merge:shouldMerge});
    this.updateBatch();
  }

  /**
  * Update an existing document with the given data
  * @param {DocumentReference} docRef the document to update
  * @param {Object} data the data to update the document described by DocRef
  */
  update(docRef, data) {
    this.batches[this.batchCount].update(docRef, data);
    this.updateBatch();
  }

  /**
  * Delete the given document from the database
  * @param{DocumentReference} docRef the path of the document to delete
  */
  delete(docRef) {
    this.batches[this.batchCount].delete(docRef);
    this.updateBatch();
  }

  /**
  * Commit each element in the batches array and log any errors
  */
  async commit() {
    let success = true;
    for(let i=0; i< this.batches.length; i++) {
      await this.waitForTimeout();
      this.batches[i].commit().then((res)=>{
        console.log(`batch ${i} committed`);
        return;
      }).catch((e)=>{
        console.log(`couldn't commit batch ${i}, encountered error ${e}`);
        success = false;
      });
    }
    return success;
  }

  waitForTimeout() {
    return new Promise((res, rej)=>{
      res(setTimeout(()=>{
        return true;
      }, this.TIMEOUT));
    });
  }
}
module.exports.BatchManager = BatchManager;
