"use strict"

var Mongo = require('./mongo')

class Inspector extends Mongo {
  constructor(options) {
    super(options)

    this.defineOptionalDependency('dispatcher', 'dispatcher', this.service)
  }

  handle(type, event) {
    console.log(123)
  }

  subscribe(emitter, msgTypes) {
    if (!emitter) return
    var msgTypes = msgTypes.constructor === Array ? msgTypes : [msgTypes]
    msgTypes.forEach((msgType) =>
      emitter.on(msgType, (msg) => this.handle(msgType, msg))
    )
  }

  *initialize() {
    this.subscribe(this.dispatcher, 'message_dispatched')
    this.subscribe(this.delivery, 'delivered')
    this.subscribe(this.deadLetter, 'killed')
    this.subscribe(this.scheduler, ['scheduled', 'enqueued'])
    this.subscribe(this.api, 'accepted')
  }
}

module.exports = Inspector
