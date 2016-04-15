"use strict"

var _ = require('lodash')
var RabbitQueue = require('./rabbit_queue')
var amqp = require('amqplib')
var co = require('co')

class Bulk extends RabbitQueue {
  constructor(options) {
    super(options)

    this.messages = this.service.subscribedBulks
    this.defineMandatoryDependency('in_queue', ':service_in')
  }

  getQueueNameFor(msgType) {
    return `${this.service.name}_${msgType}_bulk`
  }

  *initBulk(bulk) {
    bulk.channel = yield this.connection.createChannel()
    yield bulk.channel.assertQueue(this.getQueueNameFor(bulk.type))
  }

  *initialize() {
    this.connection = yield amqp.connect(this.amqpUrl)
    yield this.messages.map(_ => this.initBulk(_))
  }

  *enqueueBulk(bulk, buffer) {
    var msg = buffer.map(_ => JSON.parse(_.content.toString()))
    yield this.getDependency(':service_in').enqueue(msg)
    buffer.forEach(_ => bulk.channel.ack(_))
  }

  *packBulks(bulk) {
    var buffer = []
    var me = this
    var processMessage = function*(qmsg) {
      buffer.push(qmsg)
      if (buffer.length >= bulk.size) {
        yield this.enqueueBulk(bulk, buffer)
        buffer = []
      }
    }.bind(this)
    bulk.consumer = yield bulk.channel.consume(
      this.getQueueNameFor(bulk.type),
      qmsg => co(processMessage, qmsg).catch(_ => log.error(_))
    )
  }

  *start() {
    yield this.messages.map(_ => this.packBulks(_))
  }
}

module.exports = Bulk
