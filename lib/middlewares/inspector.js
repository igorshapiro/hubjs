"use strict"

var Mongo = require('./mongo')
var shortid = require('shortid')
var vm = require('vm')

class Inspector extends Mongo {
  constructor(options) {
    super(options)

    this.defineOptionalDependency('dead_letter', 'deadLetter', this.service)
    this.defineOptionalDependency('scheduler', 'scheduler', this.service)
    this.defineOptionalDependency('delivery', 'delivery', this.service)
    this.defineOptionalDependency('api', 'api')

    this.matchers = []
  }

  setMatchers(matchers) {
    this.matchers = matchers.map(_ => new Function('ctx', `return ${_}`))
  }

  handle(type, event) {
    try {
      var shouldLog = this.matchers.find(_ => _(event))
      if (!shouldLog) return

      this.logEvent(type, event)
    }
    catch (err) {
    }
  }

  logEvent(type, event) {
    this.logCollection.insert({type: type, event: event}, function(err) {
      if (err) {
        log.error({err: err}, "Error logging an event")
      }
    })
  }

  subscribe(emitter, msgTypes) {
    if (!emitter) return
    var msgTypes = msgTypes.constructor === Array ? msgTypes : [msgTypes]
    msgTypes.forEach((msgType) =>
      emitter.on(msgType, (ev) => this.handle(msgType, ev))
    )
  }

  *intervalHandler() { this.readMatchers() }

  readMatchers() {
    this.matchersCollection.find({}).toArray((err, matchers) => {
      if (err) {
        log.error({err: err}, "Error loading matchers")
        return
      }
      this.setMatchers(matchers.map(_ => _.expr))
    })
  }

  *initialize() {
    yield* super.initialize()

    this.logCollection = this.db.collection("inspector_log")
    this.matchersCollection = this.db.collection("inspector_matchers")

    this.readMatchers()

    this.subscribe(this.delivery, ['delivered', 'delivery_failed'])
    this.subscribe(this.deadLetter, 'killed')
    this.subscribe(this.scheduler, ['scheduled', 'enqueued'])
    this.subscribe(this.api, 'accepted')
  }
}

Inspector.isPerService = true

module.exports = Inspector
