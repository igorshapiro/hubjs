"use strict"

var shortid = require('shortid')
var Scheduler = require('./../../lib/middlewares/scheduler')
var Hub = require('./../../lib/hub/hub')

describe("Scheduler", function() {
  var service
  var hub = new Hub({manifest: {}})
  var scheduler

  beforeEach(function*() {
    service = { name: shortid.generate() }
    scheduler = new Scheduler({
      service: service,
      hub: hub,
      instanceName: shortid.generate()
    })
    yield scheduler.initialize()
  })

  describe("Concurrency", function() {
    var tryAcquire = sinon.stub()
    var release = sinon.spy()
    var lockManager = {
      *tryAcquire(name) { return tryAcquire(name) },
      *release(name) { return release(name) }
    }
    beforeEach(function*() {
      scheduler.lockManager = lockManager
    })

    it ("Doesn't checks past due messages if lock acquire failed", function*() {
      tryAcquire.returns(false)
      var spy = sinon.spy()
      scheduler.getDueMessages = function*() { spy() }
      expect(spy).to.not.have.been.called
    })

    it ("Achieves lock before checking for due messages", function*() {
      tryAcquire.returns(true)
      scheduler.getDueMessages = function*() {
        expect(tryAcquire).to.be.calledOnce
        return []
      }
      yield scheduler.doHandleScheduledMessages()
      expect(release).to.be.calledOnce
    })
  })

  describe("getDueMessages", function() {
    var msg = { text: shortid.generate() }

    it("Returns past due messages", function*() {
      yield scheduler.schedule(msg, Date.now() - 1)
      var dueMessages = yield scheduler.getDueMessages()
      expect(dueMessages.length).to.equal(1)
    })

    it("Doesn't return messages not past due", function*() {
      yield scheduler.schedule(msg, Date.now() + 1000)
      var dueMessages = yield scheduler.getDueMessages()
      expect(dueMessages.length).to.equal(0)
    })
  })
})
