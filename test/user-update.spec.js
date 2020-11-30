const admin = require('firebase-admin');
const test = require('firebase-test');
const sinon = require('sinon');
const sandbox = require('sinon').createSandbox();

beforeEach(() => {
  if (adminInitStub) {
    adminInitStub.restore();
  }
  adminInitStub = sinon.stub(admin, 'initializeApp');
  admin.credential.cert = sinon.stub().returns('fake-cert');
});

afterEach(() => {
  adminInitStub.restore();
  admin.credential.cert.restore();
});

describe('user-update', async () => {
  const myFunction = require('../user-update');
  const { BatchManager } = require('../batchManager');
  const { BigQuery } = require('@google-cloud/bigquery');
  const firestore = admin.firestore();
  const Timestamp = admin.firestore.Firestore.Timestamp;
  const DocumentReference = admin.firestore.Firestore.DocumentReference;
  const Query = admin.firestore.Firestore.Query;
  const auth = admin.auth();
  const writeBatch = admin.firestore.Firestore.WriteBatch;

  describe('/fetchUpdatesFromBigQuery', async () => {
    let dbStub;
    let commitStub;
    let addToPoolStub;
    let insertLocationStub;
    let writeStub;
    let rows;
    let stubDate;
    let stubTime;
    let timeStub;
    let makeTimestampStub;
    beforeEach(() => {
      const now = new Date(Date.now());
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const date= now.getDate();
      stubDate = year.toString() + month.toString() + date.toString();
      rows = [
        {user_pseudo_id: 'fake-user1', event_name: 'first_open', event_date: stubDate, name: 'fake-campaign', continent: 'fake-continent', country: 'fake-country', region: 'fake-region'},
        {user_pseudo_id: 'fake-user2', event_name: 'first_open', event_date: stubDate, name: 'fake-campaign', continent: 'fake-continent', country: 'fake-country', region: 'fake-region'},
        {user_pseudo_id: 'fake-user3', event_name: 'first_open', event_date: stubDate, name: 'fake-campaign', continent: 'fake-continent', country: 'fake-country', region: 'fake-region'},
        {user_pseudo_id: 'fake-user4', event_name: 'first_open', event_date: stubDate, name: 'fake-campaign', continent: 'fake-continent', country: 'fake-country', region: 'fake-region'},
        {user_pseudo_id: 'fake-user5', event_name: 'first_open', event_date: stubDate, name: 'fake-campaign', continent: 'fake-continent', country: 'fake-country', region: 'fake-region'},
        {user_pseudo_id: 'fake-user6', event_name: 'first_open', event_date: stubDate, name: 'fake-campaign', continent: 'fake-continent', country: 'fake-country', region: 'fake-region'},
        {user_pseudo_id: 'fake-user7', event_name: 'first_open', event_date: stubDate, name: 'fake-campaign', continent: 'fake-continent', country: 'fake-country', region: 'fake-region'},
        {user_pseudo_id: 'fake-user8', event_name: 'first_open', event_date: stubDate, name: 'fake-campaign', continent: 'fake-continent', country: 'fake-country', region: 'fake-region'},
        {user_pseudo_id: 'fake-user9', event_name: 'first_open', event_date: stubDate, name: 'fake-campaign', continent: 'fake-continent', country: 'fake-country', region: 'fake-region'},
        {user_pseudo_id: 'fake-user10', event_name: 'first_open', event_date: stubDate, name: 'fake-campaign', continent: 'fake-continent', country: 'fake-country', region: 'fake-region'},
      ];
      dbStub = sandbox.stub(BigQuery.prototype, 'query').returns(rows);
      commitStub = sandbox.stub(writeBatch, 'commit').resolves();
      addToPoolStub = sandbox.stub(myFunction, 'addUserToPool');
      insertLocationStub = sandbox.stub(myFunction, 'insertLocation');
      stubTime = Timestamp.now();
      timeStub = sandbox.stub(Timestamp, 'now').returns(stubTime);
      dateStub = sandbox.stub(Timestamp, 'fromDate').returns(stubTime);
      makeTimestampStub = sandbox.stub(myFunction, 'makeTimestmap');
      makeTimestampStub.returns(stubDate);
      writeStub = sandbox.stub(myFunction, 'writeToDb');
    });
    afterEach(() => {
      sandbox.restore();
    });

    it('should call commit with 10 users', async () => {
      await myFunction.fetchUpdatesFromBigQuery();
      createStub.should.have.callCount(10);
    });
  });
});
