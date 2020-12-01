const admin = require('firebase-admin');
const test = require('firebase-test');
const sinon = require('sinon');
const sandbox = require('sinon').createSandbox();
admin.initializeApp();
let adminInitStub = sinon.stub(admin, 'initializeApp');

beforeEach(() => {
  adminInitStub.restore();
  adminInitStub = sinon.stub(admin, 'initializeApp');
  certStub = sinon.stub(admin.credential, 'cert').returns('fake-cert');
});

afterEach(() => {
  adminInitStub.restore();
  certStub.restore();
});

describe('user-update', (done) => {
  const myFunction = require('../user-update');
  const { BatchManager } = require('../batchManager');
  const { BigQuery } = require('@google-cloud/bigquery');
  const firestore = admin.firestore();
  const Timestamp = admin.firestore.Firestore.Timestamp;
  const DocumentReference = admin.firestore.Firestore.DocumentReference;
  const Query = admin.firestore.Firestore.Query;
  const {Client, Status} = require('@googlemaps/google-maps-services-js');
  const auth = admin.auth();
  const writeBatch = admin.firestore.Firestore.WriteBatch;
  const {GMAPError} = require('./gMapError');

  describe('/fetchUpdatesFromBigQuery', (done) => {
    let dbStub;
    let commitStub;
    let addToPoolStub;
    let insertLocationStub;
    let setStub;
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
      dbStub = sandbox.stub(BigQuery.prototype, 'query').returns([rows]);
      commitStub = sandbox.stub(BatchManager.prototype, 'commit').resolves();
      insertLocationStub = sandbox.stub(myFunction, 'insertLocation');
      stubTime = Timestamp.now();
      timeStub = sandbox.stub(Timestamp, 'now').returns(stubTime);
      dateStub = sandbox.stub(Timestamp, 'fromDate').returns(stubTime);
      makeTimestampStub = sandbox.stub(myFunction, 'makeTimestamp');
      makeTimestampStub.returns(stubDate);
      setStub = sandbox.stub(BatchManager.prototype, 'set');
    });
    afterEach(() => {
      sandbox.restore();
    });
    it('should stub out cert', async () => {
      const res = admin.credential.cert();
      res.should.equal('fake-cert');
    });
    it('should call commit with 10 users', async () => {
      const createSpy = sandbox.spy(myFunction, 'createUser');
      await myFunction.fetchUpdatesFromBigQuery();
      createSpy.should.have.callCount(10);
    });
    it('should throw an error if data fetch fails', async () => {
      sandbox.spy(console, 'error');
      dbStub.throws('fake-error');
      await myFunction.fetchUpdatesFromBigQuery();
      console.error.should.have.been.called;
    });
    it('should call batchManager.set 10 times', async () => {
      await myFunction.fetchUpdatesFromBigQuery();
      setStub.should.have.callCount(10);
    });
    it('should call BatchManager.set 10 times with 10 dupes', async () => {
      const dupeRows = rows.concat(rows);
      dbStub.returns([dupeRows]);
      await myFunction.fetchUpdatesFromBigQuery();
      setStub.should.have.callCount(10);
    });
  });

  describe('/insertLocation', () => {
    let getStub;
    let pinStub;
    let setStub;
    let row;
    let batch;
    let docRef;
    let markerLoc;
    beforeEach(() => {
      row = {
        user_pseudo_id: 'fake-user',
        country: 'fake-country',
        continent: 'fake-continent',
      };
      docRef = {
        id: 'fake-country',
        exists: 'true',
        data: () => {
          return {
            country: 'fake-country',
            regions: [{region: 'fake-region', learnerCount: 0}],
            learnerCount: 0,
            pin: {
              lat: 0,
              lng: 0,
            },
          };
        },
      };
      markerLoc = {
        lat: 20,
        lng: 30,
      };
      getStub = sandbox.stub(DocumentReference.prototype, 'get');
      getStub.resolves(docRef);
      pinStub= sandbox.stub(myFunction, 'getPinForAddress');
      pinStub.callsArgWith(1, markerLoc, null);
      setStub = sandbox.stub(BatchManager.prototype, 'set').resolves();
      batch = new BatchManager();
    });
    afterEach(() => {
      sandbox.restore();
    });
    it('should call set with proper pin data', async () => {
      await myFunction.insertLocation(row, batch);
      setStub.should.have.been.calledWith(sinon.match.any, {
        pin: markerLoc,
      }, true);
    });
    it('should call set with a new pin when none exists', async () => {
      docRef.pin = null;
      await myFunction.insertLocation(row, batch);
      setStub.should.have.been.calledWith(sinon.match.any, {
        pin: markerLoc,
      }, true);
    });
    it('should call set with a new country document', async () => {
      docRef.exists = false;
      await myFunction.insertLocation(row, batch);
      setStub.should.have.been.calledWith(sinon.match.any, {
        country: row.country,
        continent: row.continent,
        learnerCount: 0,
        pin: markerLoc,
        regions: [],
      }, true);
    });
    it('should warn if given no data', async () => {
      row = {user_pseudo_id: row.user_pseudo_id};
      const spy = sandbox.spy(console, 'warn');
      await myFunction.insertLocation(row, batch);
      spy.should.have.been.calledWith('fake-user has no location data!');
    });
    it('should log an error on failed API call', async () => {
      pinStub.callsArgWith(1, null, new GMAPError('fake-error'));
      sandbox.spy(console, 'error');
      await myFunction.insertLocation(row, batch);
      const expected = sinon.match.instanceOf(GMAPError).and(sinon.match
          .has('message', 'fake-error'));
      console.error.should.have.been.calledWith(expected);
    });
    it('should log an error on failed batch update', async () => {
      setStub.rejects('fake-error');
      sandbox.spy(console, 'error');
      await myFunction.insertLocation(row, batch);
      console.error.should.have.been.called;
    });
  });

  describe('/getPinForAddress', () => {
    let address;
    let callback;
    let geoStub;
    let res;
    beforeEach(() => {
      res = {
        data: {
          results: [{
            geometry: {
              location: {lat: 20, lng: 30},
            },
          }],
        },
      };
      address = 'fake-country';
      callback = sandbox.fake();
      geoStub = sandbox.stub(Client.prototype, 'geocode').resolves(res);
    });
    afterEach(() => {
      sandbox.restore();
    });
    it('should call the callback with {lat:20, lng:30}', async () => {
      await myFunction.getPinForAddress(address, callback);
      callback.should.have.been.calledWith({lat: 20, lng: 30}, null);
    });
    it('should call geocode with "Country of Georgia"', async () => {
      address = 'Georgia';
      await myFunction.getPinForAddress(address, callback);
      geoStub.should.have.been.calledWith({params: {
        address: 'Country of Georgia',
        key: sinon.match.any,
      }, timeout: sinon.match.any});
    });
    it('should call the callback with an error on API failure', async () => {
      const error = new GMAPError('fake-error');
      geoStub.rejects(error);
      await myFunction.getPinForAddress(address, callback);
      const expected = sinon.match.instanceOf(GMAPError).and(sinon.match
          .has('message', 'fake-error'));
      callback.should.have.been.calledWith(null, expected);
    });
    it('should call the callback with an error if no pin found', async () => {
      res.data.results = [];
      await myFunction.getPinForAddress(address, callback);
      const expected = sinon.match.instanceOf(Error).and(sinon.match
          .has('message', 'no data found for address: fake-country'));
      callback.should.have.been.calledWith(null, expected);
    });
  });

  describe('/createUser', () => {
    let makeTimestampStub;
    let stubTime;
    let timeStub;
    let row;
    let expected;
    beforeEach(() => {
      stubTime = Timestamp.now();
      timeStub = sandbox.stub(Timestamp, 'now').returns(stubTime);
      makeTimestampStub = sandbox.stub(myFunction, 'makeTimestamp');
      makeTimestampStub.returns(stubTime);
      row = {
        user_pseudo_id: 'fake-user',
        country: 'fake-country',
        region: 'fake-region',
        continent: 'fake-continent',
        event_name: 'first_open',
        name: 'fake-campaign',
      };
      expected = {
        userID: row.user_pseudo_id,
        dateCreated: stubTime,
        dateIngested: stubTime,
        sourceCampaign: row.name,
        region: row.region,
        country: row.country,
        continent: row.continent,
        learnerLevel: row.event_name,
        userStatus: 'unassigned',
        sourceDonor: 'unassigned',
        countedInMasterCount: false,
        countedInRegion: false,
        countedInCampaign: false,
      };
    });
    afterEach(() => {
      sandbox.restore();
    });
    it('should create a user doc with the proper arguments', async () => {
      const res = myFunction.createUser(row);
      res.should.deep.equal(expected);
    });
    it('should fill in missing region data', async () => {
      row.country = null;
      row.continent = null;
      row.region = null;
      row.name = null;
      expected.country = 'no-country';
      expected.region = 'no-region';
      expected.continent = 'not-set';
      expected.sourceCampaign = 'no-source';
      const res = myFunction.createUser(row);
      res.should.deep.equal(expected);
    });
    it('should default to ingestion time if dateCreated is missing', async ()=>{
      makeTimestampStub.throws();
      const res= myFunction.createUser(row);
      res.should.deep.equal(expected);
    });
  });
  describe('/makeTimestamp', () => {
    let date;
    let fromDateSpy;
    beforeEach(() => {
      date = '19700101';
      fromDateSpy = sandbox.spy(Timestamp, 'fromDate');
    });
    afterEach(() => {
      sandbox.restore();
    });
    it('should create a Timestamp object from the date string', async () => {
      const expected = Timestamp.fromDate(new Date('1970-01-01'));
      const res = myFunction.makeTimestamp(date);
      res.should.deep.equal(expected);
    });
    it('should throw an error on malformed input', async () => {
      const date = 'bad-date';
      try {
        await myFunction.makeTimestamp(date);
      } catch (e) {
      }
      fromDateSpy.should.have.thrown('Error');
    });
  });
});
