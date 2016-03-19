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
    instanceName: shortid.generate()
  })
}

describe.only("Archive", function() {
  describe("logAcceptedMessage", function() {
    var archive
    beforeEach(function*() {
      archive = createTestMiddleware(Archive)
      archive.inQueue = new TestEmitter()
    })

    it("is called on inQueue.received event", function*() {
      archive.logAcceptedMessage = sinon.spy()

      yield archive.initialize()
      archive.inQueue.emit('received', { a: 1 })

      expect(archive.logAcceptedMessage).to.have.been.calledWith({a: 1})
    })

    describe("collection.insert", function() {
      beforeEach(function*() {
        yield archive.initialize()
        archive.collection.insert = sinon.spy()
      })

      it ("is called for the message", function*() {
        archive.logAcceptedMessage({msg: {a: 1}})
        archive.logAcceptedMessage({msg: {attemptsMade: 0}})
        expect(archive.collection.insert).to.have.been.calledWith({a: 1})
        expect(archive.collection.insert).to.have.been.calledWith({attemptsMade: 0})
      })

      it ("not called if msg has recurringMessageId", function*() {
        archive.logAcceptedMessage({msg: {recurringMessageId: 123}})
        expect(archive.collection.insert).to.not.have.been.called
      })

      it ("not called if msg is a retry", function*() {
        archive.logAcceptedMessage({msg: {attemptsMade: 1}})
        expect(archive.collection.insert).to.not.have.been.called
      })
    })
  })
})
