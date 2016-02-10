"use strict"

var Middleware = require('./middleware')

class Dispatcher extends Middleware {
  constructor(options) {
    super(options)

    this.defineMandatoryDependency('in_queue', ':service_in')
  }

  *handle(msg) {
    for (var sub of this.hub.getSubscribersOf(msg)) {
      yield this.getDependency(':service_in', sub).enqueue(msg)
    }
  }
}

Dispatcher.isPerService = true

module.exports = Dispatcher
