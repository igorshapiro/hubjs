"use strict"

var RabbitQueue = require('./rabbit_queue')
var _ = require('lodash')

class OutQueue extends RabbitQueue {
  constructor(options) {
    super(_.merge(options, {
      queueName: `${options.service.name}_out`
    }))
    this.supports[this.buildInstanceName('dispatcher', this.service)] = 'handler'
  }
}

module.exports = OutQueue
