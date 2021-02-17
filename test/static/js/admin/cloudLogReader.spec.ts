import * as sinon from 'sinon';
import * as proxyquire from 'proxyquire';
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
  let postStub: sinon.SinonStub;
  beforeEach(() => {
    postStub = sandbox.stub(Helpers, 'post');
  });
  afterEach(() => {
    sandbox.restore();
  });
  describe('getLatestLogs', function() {
    let formatStub: sinon.SinonStub;
    let options: any;
    let res: any;
    let run: () => any;
    beforeEach(() => {
      options = {
        resources: ['projects/follow-the-learners'],
        filter: '',
        orderBy: '',
        pageSize: 50,
        pageToken: '',
      };
      res = {json:[
        {severity: 'LOG', message: 'testLog', source: 'cloudfunctions/method1'},
        {severity: 'LOG', message: 'testLog', source: 'cloudfunctions/method2'},
        {severity: 'LOG', message: 'testLog', source: 'cloudfunctions/method3'},
        {severity: 'LOG', message: 'testLog', source: 'cloudfunctions/method4'},
        {severity: 'LOG', message: 'testLog', source: 'cloudfunctions/method5'},
      ], ok: true, error: null};
      postStub.returns(res);
      formatStub = sandbox.stub(
        CloudLogReader.prototype,
        <any>'formatOptionsObject');
      formatStub.returns(options);
      run = async () => {
        const app = new CloudLogReader(new AdminConfig());
        return await app.getLatestLogs();
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
      data.should.deep.equal({data: res.json, error: null});
    });
    it('should return a no data object if no logs', async () => {
      postStub.returns({json:[], ok: true, error: null});
      const data = await run();
      data.should.deep.equal({data: 'no-data', error: null});
    });
    it('should log and return an error on error from server', async () => {
      postStub.returns({json: undefined, ok: false, error: {status: 400}});
      const data = await run();
      data.should.deep.equal({
        data: null,
        error: 'could not fetch data from CloudLogging API'
      });
    }); });
  describe('getLatestErrors', function() {
    let formatStub: sinon.SinonStub;
    let options: any;
    let cutoff: string;
    let res: any;
    let run: () => any;
    beforeEach(() => {
      let cutoff = '2020-01-15T15:01:23.0350z';
      options = {
        resources: ['projects/follow-the-learners'],
        filter: `severity > = "ERROR" AND timestamp >= ${cutoff}`,
        orderBy: '',
        pageSize:50,
        pageToken: '',
      };
      res = {json: [
        {severity: 'ERROR', message: 'testLog', source: 'cloudfunctions/method1'},
        {severity: 'ERROR', message: 'testLog', source: 'cloudfunctions/method2'},
        {severity: 'ERROR', message: 'testLog', source: 'cloudfunctions/method3'},
        {severity: 'ERROR', message: 'testLog', source: 'cloudfunctions/method4'},
        {severity: 'ERROR', message: 'testLog', source: 'cloudfunctions/method5'},
      ], ok: true, error: null};
      formatStub =
        sandbox.stub(CloudLogReader.prototype, <any>'formatOptionsObject');
      formatStub.returns(options);
      postStub.returns(res);
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
    it('should return errors received from logging api', async () => {
      const data = await run();
      data.should.deep.equal({data: res.json, error: null});
    });
    it('should return no data object if no logs received', async () => {
      postStub.returns({json:[], ok: true, error: null});
      const data = await run();
      data.should.deep.equal({data: 'no-data', error: null});
    });
    it('should return and log an error if an error is received', async () => {
      postStub.returns({json: undefined, ok: false, error: {status: 400}});
      const data = await run();
      data.should.deep.equal({
        data: null,
        error: 'could not fetch data from CloudLogging API',
      });
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
