"use strict"

var RabbitQueue = require('./rabbit_queue')
var _ = require('lodash')

class InQueue extends RabbitQueue {
  constructor(options) {
    super(_.merge(options, {
      queueName: `${options.service.name}_in`
    }))
    if (this.service.maintenance) {
      log.warn({ queueName: this.queueName, service: this.service.name }, "Maintenance mode. Messages will be queued, but will not be delivered to the service")
    }
    else {
      this.defineOptionalDependency('delivery', 'handler', this.service)
    }
  }
}

module.exports = InQueue
