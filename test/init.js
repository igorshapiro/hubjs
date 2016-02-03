global.chai = require('chai')
global.expect = chai.expect

chai.use(require('chai-as-promised'))

global.nock = require('nock')
global.co = require('co')
global._ = require('lodash')
require('./test_helper')()
