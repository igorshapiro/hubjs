"use strict"

var Middleware = require('./middleware')

class Dispatcher extends Middleware {
  constructor(options) {
    super(options)

    this.hub.services.forEach((svc) => {
      this.needs[this.buildInstanceName('in_queue', svc)] = `${svc.name}_in`
    })
  }

  *handle(msg) {
    for (var sub of this.hub.getSubscribersOf(msg)) {
      var inQueue = this[`${sub.name}_in`]
      yield inQueue.enqueue(msg)
    }
  }
}

Dispatcher.isPerService = true

module.exports = Dispatcher
