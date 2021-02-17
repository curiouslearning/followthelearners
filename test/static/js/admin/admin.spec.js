"use strict";
exports.__esModule = true;
var sinon = require("sinon");
var admin_1 = require("../../../../static/js/admin/admin");
var sandbox;
beforeEach(function () {
    sandbox = sinon.createSandbox();
});
afterEach(function () {
    sandbox.restore();
});
describe('admin', function () {
    var test = new admin_1.AdminApp();
});
