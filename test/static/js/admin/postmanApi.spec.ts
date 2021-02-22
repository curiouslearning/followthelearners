import * as sinon from 'sinon';
import { Helpers } from '../../../../static/js/helpers';
import { PostmanApi } from '../../../../static/js/admin/postmanApi';
import { AdminConfig } from '../../../../static/js/admin/adminConfig';
let sandbox: sinon.SinonSandbox;
beforeEach(() => {
  sandbox = sinon.createSandbox();
});
afterEach(() => {
  sandbox.restore();
})
describe('PostmanApi', function () {
  describe ('getMonitorId', function () {
    let monitor: string;
    let expected: string;
    let run: ()=> {name: string, id: string} | {};
    beforeEach(() => {
      monitor = 'frontEnd';
      expected = new AdminConfig().monitorIds[0].id;
      run = () => {
        const app = new PostmanApi(new AdminConfig());
        return app['getMonitorId'](monitor);
      };
    });
    afterEach(() => {
      sandbox.restore();
    });

    it('should call getMonitorId', async () => {
      const spy = sandbox.spy(PostmanApi.prototype, <any>'getMonitorId');
      await run();
      spy.should.have.been.called;
    });
    it('should return the monitor id', async () => {
      const res = await run();
      res!.should.equal(expected);
    });
    it('should return empty object on bad key', async () => {
      monitor = 'badMonitor';
      const res = await run();
      res.should.equal('');
    });
  });
  describe('runMonitor', function () {
    let monitor: string;
    let postStub: sinon.SinonStub;
    let response: any;
    let expected: any;
    let run: () => Promise<any>;
    beforeEach(() =>{
      monitor = 'frontEnd';
      response = {
        json: {
          run: {info: {status: 'success'}},
        },
        ok: true,
        error: null,
      };
      expected = {
        data: response.json,
        error: null,
      };
      postStub = sandbox.stub(Helpers, 'post');
      postStub.returns(response);
      run = async () => {
        const api = new PostmanApi(new AdminConfig());
        return await api.runMonitor(monitor);
      };
    });
    afterEach(() => {
      sandbox.restore();
    });
    it('should call runMonitor', async () => {
      const spy = sandbox.spy(PostmanApi.prototype, 'runMonitor');
      await run();
      spy.should.have.been.called;
    });
    it('should return response', async () => {
      const data = await run();
      data.should.deep.equal(expected);
    });
    it('should return a "no-data" object on no data', async () => {
      response.json = {};
      postStub.returns(response);
      expected = {
        data: 'no-data',
        error: null
      }
      const data = await run();
      data.should.deep.equal(expected);
    });
    it('should error on bad data', async () => {
      monitor = 'badMonitor';
      const spy = sandbox.spy(PostmanApi.prototype, 'runMonitor');
      try {
        const data = await run();
      } catch(e) {
        console.log(e);
      }
      spy.should.have.thrown;
    });
  });
});
