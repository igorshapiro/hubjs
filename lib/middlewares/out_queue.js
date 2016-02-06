"use strict"

var RabbitQueue = require('./rabbit_queue')

class OutQueue extends RabbitQueue {
  constructor(options) {
    super(options)
  }
}

module.exports = OutQueue
