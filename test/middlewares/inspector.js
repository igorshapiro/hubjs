"use strict"

var shortid = require('shortid')
var Inspector = require('./../../lib/middlewares/inspector')
var Hub = require('./../../lib/hub/hub')
var bluebird = require('bluebird')
const EventEmitter = require('events')

describe.only("Inspector", function() {
  var service, inspector
  var hub = new Hub({manifest: {}})

  beforeEach(function*() {
    service = { name: shortid.generate() }
    inspector = new Inspector({
      service: service,
      hub: hub,
      instanceName: shortid.generate()
    })
  })

  function testSubscription(middleware, msgType, name) {
    return function*() {
      var emitter = new EventEmitter()
      inspector[name] = emitter

      var spy = sinon.spy()
      inspector.handle = spy
      var msg = { id: shortid.generate() }

      yield inspector.initialize()
      emitter.emit(msgType, msg)


      expect(spy).to.have.been.calledWith(msgType, msg)
    }
  }

  var eventTypes = [
    { mw: "dispatcher", name: "dispatcher", type: "message_dispatched" },
    { mw: "delivery", name: "delivery", type: "delivered" },
    { mw: "dead_letter", name: "deadLetter", type: "killed" },
    { mw: "scheduler", name: "scheduler", type: "scheduled" },
    { mw: "scheduler", name: "scheduler", type: "enqueued" },
    { mw: "api", name: "api", type: "accepted" },
  ]

  for (var eventType of eventTypes) {
    it (`Subscribes to ${eventType.mw}.${eventType.type}`,
      testSubscription(eventType.mw, eventType.type, eventType.name)
    )
  }
})
