"use strict"

var RabbitQueue = require('./rabbit_queue')
var _ = require('lodash')

class OutQueue extends RabbitQueue {
  constructor(options) {
    super(_.merge(options, {
      queueName: `${options.service.name}_out`
    }))
    this.defineOptionalDependency('dispatcher', 'handler', this.service)
  }
}

module.exports = OutQueue
