"use strict"

var shortid = require('shortid')
var Scheduler = require('./../../lib/middlewares/scheduler')
var Hub = require('./../../lib/hub/hub')

describe("Scheduler", function() {
  var service = { name: shortid.generate() }
  var hub = new Hub({manifest: {}})
  var scheduler

  beforeEach(function*() {
    scheduler = new Scheduler({
      service: service,
      hub: hub,
      instanceName: shortid.generate()
    })
    yield scheduler.initialize()
  })
  // describe("Concurrency", function() {
  //   it("Achieves lock before checking for due messages", function*() {
  //     var scheduler = new Scheduler({
  //       service:
  //     })
  //     var lock = sinon.spy()
  //   })
  // })

  describe("getDueMessages", function() {
    var msg = { text: shortid.generate() }

    it.only ("Returns past due messages", function*() {
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
