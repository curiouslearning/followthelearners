'use strict';

var chai = require('chai'),
    Promise = require('bluebird'),
    chaiAsPromised = require('chai-as-promised'),
    sinonChai = require('sinon-chai');

global.should = chai.should();
chai.use(chaiAsPromised);
chai.use(sinonChai);

global.expect = chai.expect;
global.AssertionError = chai.AssertionError;
global.Assertion = chai.Assertion;
global.assert = chai.assert;
