import * as sinon from 'sinon';
import { AdminStoplightChart } from
  '../../../../static/js/admin/adminStoplightChart';
import { Helpers } from '../../../../static/js/helpers';
import { PostmanApi } from '../../../../static/js/admin/postmanApi';
import { CloudLogReader } from '../../../../static/js/admin/cloudLogReader';
import { AdminConfig } from '../../../../static/js/admin/adminConfig';
let sandbox: sinon.SinonSandbox;

beforeEach(()=>{
  sandbox = sinon.createSandbox();
});

afterEach(() => {
  sandbox.restore();
});

describe('adminStoplightChart', function() {
  let stoplightStub: sinon.SinonStub;
  beforeEach(() => {
      stoplightStub =
        sandbox.stub(AdminStoplightChart.prototype, <any>'updateStoplightCell');
  });

  afterEach(() => {
    sandbox.restore();
  });
  describe('getPostmanData', function() {
    let getStub: sinon.SinonStub;
    let resData: any;
    let run: ()=> Promise<any>;
    beforeEach(() => {
      resData = {
        data:{
          run: {
            info: {
              status: 'succeeded',
            },
          },
        },
        error: null,
      };
      getStub = sandbox.stub(PostmanApi.prototype, 'runMonitor');
      getStub.returns(resData);
      run = async () => {
        const app = new AdminStoplightChart(new AdminConfig());
        return await app['getPostmanData']();
      }
    });

    afterEach(() => {
      sandbox.restore();
    });
    it('should call getPostmanData', async () => {
      const spy =
        sandbox.spy(AdminStoplightChart.prototype, <any>'getPostmanData');
      await run();
      spy.should.have.been.called;
    });
    it('should return an object with "good" status', async () =>{
      const res = await run();
      res.status.should.equal('good');
    });

    it('should return an object with "error" status', async () => {
      resData.data.run.info.status = 'failed';
      getStub.returns(resData);
      const res = await run();
      res.status.should.equal('error');
    });

    it('should return an object with "outage" status', async () => {
      resData.error = {status: 500} ;
      const res = await run();
      res.status.should.equal('outage');
    });
  });

  describe('getCloudData', function () {
    let data: any;
    let cloudReaderStub: sinon.SinonStub;
    let run: () => Promise<any>;
    beforeEach(() => {
      data = {
        data: [
          {log: 'error 1'},
          {log: 'error 2'},
          {log: 'error 3'},
          {log: 'error 4'},
        ],
        error: null,
      };
      cloudReaderStub =
        sandbox.stub(CloudLogReader.prototype, 'getLatestErrors');
      cloudReaderStub.returns(data);
      run = async () => {
        const app = new AdminStoplightChart(new AdminConfig());
        return await app['getCloudData']();;
      };
    });
    afterEach(() => {
      sandbox.restore();
    });

    it('should call getCloudData', async () => {
      const spy =
        sandbox.spy(AdminStoplightChart.prototype, <any>'getCloudData');
      await run();
      spy.should.have.been.called;
    });
    it('should return "good" status with no errors', async ()=>{
      data.data = [];
      const response = await run();
      response.status.should.equal('good');
    });
    it('should return "error" status on errors', async () => {
      const response = await run();
      response.status.should.equal('error');
    });
    it('should return "outage" status on 500 error', async ()=> {
      data.data = 'no-data';
      data.error = 'Could not fetch data from Cloud Logging API';
      const response = await run();
      response.status.should.equal('outage');
    });
  });
});
