require('./../config/init')

let chai = require('chai')
global.chai = chai
global.sinon = require('sinon')
var sinonChai = require('sinon-chai')
global.expect = chai.expect
chai.use(sinonChai)

chai.use(require('chai-as-promised'))

global.nock = require('nock')
global.co = require('co')
global._ = require('lodash')
require('./test_helper')()
