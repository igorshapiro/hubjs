global.chai = require('chai')
global.expect = chai.expect

chai.use(require('./helpers/expect-plugin'))
chai.use(require('chai-as-promised'))

global.request = require('supertest')
global.Hub = require('../lib/hub')
global.nock = require('nock')
global.hubClient = require('./helpers/hub_client')
global.hubHelpers = require('./helpers/hub')
global.co = require('co')
global._ = require('lodash')
require('./test_helper')()
