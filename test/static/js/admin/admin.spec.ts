import * as sinon from 'sinon';
import { AdminApp } from '../../../../static/js/admin/admin';
import { AdminConfig } from '../../../../static/js/admin/adminConfig';
let sandbox: sinon.SinonSandbox;
beforeEach((): void => {
  sandbox = sinon.createSandbox();

});

afterEach((): void =>{
  sandbox.restore();
});

describe('admin', function(): void {
  const test = new AdminApp();

});
