"use strict"

var RabbitQueue = require('./rabbit_queue')

class InQueue extends RabbitQueue {
  constructor(options) {
    super(_.merge(options, {
      queueName: `${options.name}_in`
    }))
    // this.supports[this.buildInstanceName('processor', this.service)] = 'handler'
  }
}

module.exports = InQueue
