"use strict"

var RabbitQueue = require('./rabbit_queue')
var _ = require('lodash')

class InQueue extends RabbitQueue {
  constructor(options) {
    super(_.merge(options, {
      queueName: `${options.service.name}_in`
    }))
    this.defineOptionalDependency('delivery', 'handler', this.service)
  }
}

module.exports = InQueue
