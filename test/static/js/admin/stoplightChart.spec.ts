import * as sinon from 'sinon';
import { StoplightChart } from
  '../../../../static/js/admin/stoplightChart';
import { Helpers } from '../../../../static/js/helpers';
import { AdminConfig } from '../../../../static/js/admin/adminConfig';
let sandbox: sinon.SinonSandbox;

beforeEach(()=>{
  sandbox = sinon.createSandbox();
});

afterEach(() => {
  sandbox.restore();
});

describe('StoplightChart', function () {
  describe('StoplightChart.updateStoplightCell', function () {
    let good = 'fa-check';
    let error = 'fa-exclamation-triangle';
    let outage = 'fa-exclamation-circle';
    let service: string;
    let status: string;
    let run: () => void;
    let domUpdate: sinon.SinonStub;
    let elemMock: any;
    let expected: string;
    beforeEach(() => {
      service = 'cloud';
      status = 'good';
      expected = 'fa-check';
      run = async () => {
        const app = new StoplightChart(new AdminConfig());
        //this tells TypeScript to allow us to access protected members
        await app['updateStoplightCell'](service, status);
      }
      elemMock = {
        classList: {
          add: sandbox.stub(),
          remove: sandbox.stub(),
        },
      };
      domUpdate = sandbox.stub(Helpers, 'getElement')
        .callsFake((tag: string) => {
          return {} as HTMLElement;
        });
      domUpdate.returns(elemMock);
    });

    afterEach(() => {
      sandbox.restore();
    });
    it('should call updateStoplightCell', async () => {
      const stub =
        sandbox.spy(StoplightChart.prototype, <any>'updateStoplightCell');
      await run();
      stub.should.have.been.calledWith(service, status);
    });
    it('should update the DOM with a check icon', async() => {
      await run();
      elemMock.classList.add.should.have.been.calledWith(expected);
    });

    it('should update the DOM with a triangle icon', async () => {
      status = 'error';
      expected = error;
      await run();
      elemMock.classList.add.should.have.been.calledWith(expected);
    });

    it('should update the DOM with a circle icon', async () => {
      status = 'outage';
      expected = outage;
      await run();
      elemMock.classList.add.should.have.been.calledWith(expected);
    });
  });
});
