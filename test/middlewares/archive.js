"use strict"

var Archive = require('./../../lib/middlewares/archive')
var Bluebird = require('bluebird')

var Hub = require('./../../lib/hub/hub')
var shortid = require('shortid')
const EventEmitter = require('events')
class TestEmitter extends EventEmitter { }

function createTestMiddleware(Klass) {
  var hub = new Hub({manifest: {}})
  var service = { name: shortid.generate(), expireAfterSeconds: 1 }
  return new Klass({
    hub: hub,
    service: service,
    instanceName: shortid.generate()
  })
}

describe("Archive", function() {
  describe("logAcceptedMessage", function() {
    var archive
    beforeEach(function*() {
      archive = createTestMiddleware(Archive)
      archive.inQueue = new TestEmitter()
    })

    describe("Message expiration", function() {
      it("expires messages after expireAfterSeconds", function*() {
        yield archive.initialize()

        archive.logAcceptedMessage({ msg: { a: 1 } })
        yield Bluebird.delay(100)

        expect(yield archive.getCount()).to.equal(1)
        var messages = yield archive.getMessages()
        expect(messages[0].archivedAt).to.be.ok
      })

      describe("createIndexes", function() {
        it("createIndexes creates expireAfterSeconds index", function*() {
          var createIndex = sinon.spy()
          archive.collection = {
            createIndex: function*(spec, opts) { createIndex(spec, opts) }
          }

          yield archive.createIndexes()

          expect(createIndex)
            .to.have.been.calledWithMatch({archivedAt: 1}, {expireAfterSeconds: 1})
        })

        it("is called on initialize", function*() {
          var createIndexes = sinon.spy()
          archive.createIndexes = function*() { createIndexes() }
          yield archive.initialize()
          expect(createIndexes).to.have.been.called
        })
      })
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
        expect(archive.collection.insert).to.have.been.calledWithMatch({a: 1})
        expect(archive.collection.insert).to.have.been.calledWithMatch({attemptsMade: 0})
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
