var RabbitQueue = require('./rabbit_queue')
var amqp = require('amqplib')
var co = require('co')
var shortid = require('shortid')

class Bulk extends RabbitQueue {
  constructor(options) {
    super(options)

    this.bufferTimeout = this.params.bufferTimeout || (1).minutes()
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
    var msgId = `msg_bulk_${shortid.generate()}`
    var type = bulk.type
    var msg = {
      messageId: msgId,
      id: msgId,
      type: type,
      messageType: type,
      content: buffer.map(_ => JSON.parse(_.content.toString()))
    }
    yield this.getDependency(':service_in').enqueue(msg)
    buffer.forEach(_ => bulk.channel.ack(_))
  }

  *packBulks(bulk) {
    var buffer = []

    var processMessage = function*(qmsg) {
      buffer.push(qmsg)

      if (buffer.length === 1) {
        var timeoutId = setTimeout(() => {
          var bufferToEnqueue = buffer
          buffer = []
          co(this.enqueueBulk.bind(this), bulk, bufferToEnqueue)
            .catch(_ => log.error(_))
        }, this.bufferTimeout)
      }

      if (buffer.length >= bulk.size) {
        clearTimeout(timeoutId)
        let bufferToEnqueue = buffer
        buffer = []
        yield this.enqueueBulk(bulk, bufferToEnqueue)
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
