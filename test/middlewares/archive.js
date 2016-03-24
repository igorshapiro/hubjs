"use strict"

var Archive = require('./../../lib/middlewares/archive')

var Hub = require('./../../lib/hub/hub')
var shortid = require('shortid')
const EventEmitter = require('events')
class TestEmitter extends EventEmitter { }

function createTestMiddleware(Klass) {
  var hub = new Hub({manifest: {}})
  var service = { name: shortid.generate() }
  return new Klass({
    hub: hub,
    service: service,
    instanceName: shortid.generate(),
    params: {
      s3: { suppressCreateBucket: true }
    }
  })
}

describe("Archive", function() {
  var archive
  beforeEach(function*() {
    archive = createTestMiddleware(Archive)
    archive.api = new TestEmitter()
    archive.inQueue = {}
  })

  describe("logAcceptedMessage", function() {
    it("is called on api.accepted event", function*() {
      archive.logAcceptedMessage = sinon.spy()

      yield archive.initialize()
      archive.api.emit('accepted', { a: 1 })

      expect(archive.logAcceptedMessage).to.have.been.calledWith({a: 1})
    })
  })
})
