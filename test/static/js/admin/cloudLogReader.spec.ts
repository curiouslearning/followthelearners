import * as sinon from 'sinon';
import * as proxyquire from 'proxyquire';
import { Logging } from '@google-cloud/logging';
import { Helpers } from '../../../../static/js/helpers';
import { CloudLogReader, TimestampFormat } from
  '../../../../static/js/admin/cloudLogReader';
import { AdminConfig } from '../../../../static/js/admin/adminConfig';
let sandbox: sinon.SinonSandbox;

beforeEach(() => {
  sandbox = sinon.createSandbox();
});
afterEach(() => {
  sandbox.restore();
});

describe('CloudLogReader', function () {
  beforeEach(() => {
  });
  afterEach(() => {
    sandbox.restore();
  });
  describe('getData', function() {
    let formatStub: sinon.SinonStub;
    let logStub: sinon.SinonStub;
    let getStub: sinon.SinonStub;
    let resourceName ='projects/follow-the-learners';
    let filter: string;
    let options: any;
    let res: any;
    let run: () => any;
    beforeEach(() => {
      filter = '';
      options = {
        resources: [resourceName],
        filter: filter,
        orderBy: '',
        pageSize: 50,
        pageToken: '',
      };
      res = [[
        {metadata: {severity: 'LOG', source: 'cloudfunctions/method1'}, data: 'testLog'},
        {metadata: {severity: 'LOG', source: 'cloudfunctions/method2'}, data: 'testLog'},
        {metadata: {severity: 'LOG', source: 'cloudfunctions/method3'}, data: 'testLog'},
        {metadata: {severity: 'LOG', source: 'cloudfunctions/method1'}, data: 'testLog'},
        {metadata: {severity: 'LOG', source: 'cloudfunctions/method3'}, data: 'testLog'},
      ], options];
      formatStub = sandbox.stub(
        CloudLogReader.prototype,
        <any>'formatOptionsObject');
      formatStub.returns(options);
      getStub.returns(res);
      logStub = sandbox.stub(Logging.prototype, 'log');
      logStub.returns({
        getEntries: getStub,
      });
      run = async () => {
        const app = new CloudLogReader(new AdminConfig());
        return await app['getData'](resourceName, filter);
      };
    });
    afterEach(() => {
      sandbox.restore();
    });
    it('should call getLatestLogs', async () => {
      const spy = sandbox.spy(CloudLogReader.prototype, 'getLatestLogs');
      await run();
      spy.should.have.been.called;
    });
    it('should return a list of logs', async () => {
      const data = await run();
      data.should.deep.equal({data: res[0], error: null});
    });
    it('should return a no data object if no logs', async () => {
      getStub.returns([[], options]);
      const data = await run();
      data.should.deep.equal({data: 'no-data', error: null});
    });
    it('should log and return an error on error from server', async () => {
      getStub.returns([null, options]);
      const data = await run();
      data.should.deep.equal({
        data: null,
        error: 'could not fetch data from CloudLogging API'
      });
    });
  });
  describe('getLatestLogs', function () {
    let getStub: sinon.SinonStub;
    let resourceName: string;
    let cutoff: string;
    let expectedFilter: string;
    let res: any;
    let run: () => any;
    beforeEach(() => {
      getStub = sandbox.stub(CloudLogReader.prototype, <any>'getData');
      resourceName = 'projects/follow-the-learners';
      cutoff = '2020-01-15T15:01:23.0350z';
      expectedFilter = `timestamp >= ${cutoff}`;
      run = async () => {
        const app = new CloudLogReader(new AdminConfig());
        return await app.getLatestLogs();
      }
    });
    afterEach(() => {
      sandbox.restore();
    });

    it('should call getLatestLogs', async() => {
      const spy = sandbox.spy(CloudLogReader.prototype, 'getLatestLogs');
      await run();
      spy.should.have.been.called;
    });
    it('call get with good data', async () => {
      const data = await run();
      getStub.should.have.been.calledWith(resourceName, expectedFilter);
    });
  });
  describe('getLatestErrors', function() {
    let getStub: sinon.SinonStub;
    let resourceName: string;
    let cutoff: string;
    let expectedFilter: string;
    let res: any;
    let run: () => any;
    beforeEach(() => {
      getStub = sandbox.stub(CloudLogReader.prototype, <any>'getData');
      resourceName = 'projects/follow-the-learners';
      cutoff = '2020-01-15T15:01:23.0350z';
      expectedFilter = `severity > = "ERROR" AND timestamp >= ${cutoff}`;
      run = async () => {
        const app = new CloudLogReader(new AdminConfig());
        return await app.getLatestErrors();
      }
    });
    afterEach(() => {
      sandbox.restore();
    });

    it('should call getLatestErrors', async() => {
      const spy = sandbox.spy(CloudLogReader.prototype, 'getLatestErrors');
      await run();
      spy.should.have.been.called;
    });
    it('call get with good data', async () => {
      const data = await run();
      getStub.should.have.been.calledWith(resourceName, expectedFilter);
    });
  });
  describe('getCutoff', function() {
    let date: Date;
    let dayInterval: number;
    let expected: string;
    let format: TimestampFormat;
    let run: () => string;
    beforeEach(() => {
      date = new Date('2020-01-15T15:01:23.030Z');
      dayInterval = 1;
      expected = '2020-01-14T15:01:23.030Z';
      sandbox.useFakeTimers({now: date.getTime()});
      format = TimestampFormat.RSC;
      run = () => {
        const app = new CloudLogReader(new AdminConfig());
        return app['getCutoff'](format, dayInterval);
      };
    });
    afterEach(() => {
      sandbox.restore();
    });

    it('should call getCutoff', () => {
      const spy = sandbox.spy(CloudLogReader.prototype, <any>'getCutoff');
      run();
      spy.should.have.been.called;
    });
    it('should return 2020-01-14T15:01:23.030Z', () => {
      const cutoff = run();
      cutoff.should.equal(expected);
    });
    it('should return 2020-01-14', () => {
      format = TimestampFormat.ISO;
      expected = '2020-01-14';
      const cutoff = run();
      cutoff.should.equal(expected);
    });
    it('should return a cutoff of 48 hours earlier', () => {
      dayInterval = 2;
      format = TimestampFormat.ISO;
      expected = '2020-01-13';
      const cutoff = run();
      cutoff.should.equal(expected);
    });
  });
  describe('formatOptionsObject', function () {
    let resources: Array<string>;
    let filter: string;
    let orderBy: string;
    let pageSize: number;
    let pageToken: string;
    let expected: any;
    let run: () => any;
    beforeEach(() => {
      resources = ['projects/project1'];
      filter = 'severity >= "ERROR" AND timestamp >= 2020-01-14',
      orderBy = 'timestamp (DESC)';
      pageSize = 100;
      pageToken = 'fake-token';
      expected = {
        resources: resources,
        filter: filter,
        orderBy: orderBy,
        pageSize: pageSize,
        pageToken: pageToken
      };
      run = () => {
        const app = new CloudLogReader(new AdminConfig());
        return app['formatOptionsObject'](resources,
          filter,
          orderBy,
          pageSize,
          pageToken);
      };
    });
    afterEach(() => {
      sandbox.restore();
    });
    it('should call formatOptionsObject', () => {
      const spy =
        sandbox.spy(CloudLogReader.prototype, <any>'formatOptionsObject');
      run();
      spy.should.have.been.called;
    });
    it('should organize the options successfully', () => {
      const res = run();
      res.should.deep.equal(expected);
    });
    it('should throw an error on no resources', () => {
      const spy =
        sandbox.spy(CloudLogReader.prototype, <any>'formatOptionsObject');
      try {
        resources = [];
        const res = run();
      } catch (e) {
        console.log(e);
      }
      spy.should.have.thrown;
    });
    it('should add empty strings where necessary', () => {
        filter = '';
        expected.filter = filter;
        orderBy = '';
        expected.orderBy = orderBy;
        pageToken = '';
        expected.pageToken = pageToken;
        const res = run();
        res.should.deep.equal(expected);
    });
  });
});
