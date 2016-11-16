var Transport = require('./transport')
var Bluebird = require('bluebird')
var _ = require('lodash')
var amqp = require('amqplib')
var co = require('co')

class RabbitQueue extends Transport {
  constructor(options) {
    super(_.merge(options, {
      defaultPort: 5672,
      defaultUrl: 'rabbitmq://localhost',
      urlProperty: 'queue',
      protocol: 'rabbitmq'
    }))
    this.queueName = options.queueName
    this.messagesBeingHandled = 0
    var auth = this.url.auth ? (this.url.auth + '@') : ''
    this.amqpUrl = `amqp://${auth}${this.host}:${this.port}`

    this.defineOptionalDependency('concurrency_manager', 'concurrencyManager', this.service)
    this.defineOptionalDependency('stats_reporter', 'stats')
  }

  *initialize() {
    this.connection = yield amqp.connect(this.amqpUrl)
    this.channel = yield this.connection.createChannel()

    yield this.channel.assertQueue(this.queueName)
  }

  *setConcurrency(concurrency) {
    concurrency = Math.floor(concurrency)
    if (concurrency === this.dynamicConcurrency) return
    log.debug(`Adjusting ${this.queueName} concurrency to ${concurrency}`)
    yield this.channel.prefetch(concurrency)
    this.dynamicConcurrency = concurrency
    yield this.startConsumingMessages()
  }

  processQueueMessage(qmsg) {
    if (!qmsg) return
    if (this.stopped) return
    this.messagesBeingHandled++

    log.trace({msg: qmsg}, 'Processing queue message')

    var msg = JSON.parse(qmsg.content.toString())
    log.trace({queue: this.queueName, message: msg})
    co(function*() {
      this.emit('received', {
        msg: msg,
        service: this.service.name
      })
      try {
        yield this.handler.handle(msg)
      } catch (err) {
        log.error(err, 'Error processing message')
      } finally {
        var messageInfo = {
          tag: qmsg.fields.deliveryTag,
          queue: this.queueName,
          msgId: msg.messageId,
          consumer: this.consumer
        }
        log.trace(messageInfo, 'Acknowledging RabbitMQ message')
        this.channel.ack(qmsg)
        this.messagesBeingHandled--
      }
    }.bind(this))
    .catch(_ => log.error(_))
  }

  *startConsumingMessages() {
    if (!this.handler) return

    if (this.consumer) {
      yield this.channel.cancel(this.consumer.consumerTag)
      this.consumer = null
    }
    this.consumer = yield this.channel.consume(
      this.queueName,
      _ => this.processQueueMessage(_)
    )
    log.trace({
      consumer: this.consumer,
      queue: this.queueName,
      instanceName: this.instanceName,
      serviceName: this.service.name
    }, 'Created consumer')
  }

  *start() {
    // Set concurrency and start consuming messages only if there's no
    // concurrency manager. Otherwise wait for the concurrency adjustment
    // command
    if (!this.concurrencyManager) {
      yield this.setConcurrency(this.service.concurrency)
    }
  }

  reportMissedMessage(msg) {
    if (this.stats) this.stats.increment(msg, this.service, 'rabbitmq_missed')
  }

  *enqueue(msg) {
    if (this.stopped) {
      return log.error({msg: msg}, 'Trying to enqueue message for stopped RabbitMQ')
    }
    var bufferFull = !this.channel.publish(
      '',
      this.queueName,
      new Buffer(JSON.stringify(msg)),
      {persistent: true}
    )
    if (bufferFull) this.reportMissedMessage(msg)
  }

  *publish(msg) {
    if (this.stopped) {
      return log.error({msg: msg}, 'Trying to publish message for stopped RabbitMQ')
    }
    var bufferFull = !this.channel.publish(
      msg.messageType,
      '',
      new Buffer(JSON.stringify(msg)),
      {persistent: true}
    )
    if (bufferFull) this.reportMissedMessage(msg)
  }

  *getCount() {
    var queue = yield this.channel.assertQueue(this.queueName)
    return queue.messageCount
  }

  *drainMessages() {
    log.trace({queue: this.queueName}, `Draining ${this.messagesBeingHandled} messages`)
    while (this.messagesBeingHandled) {
      yield Bluebird.delay(50)
    }
  }

  *purge() {
    if (this.channel) yield this.channel.deleteQueue(this.queueName)
  }

  *stop() {
    yield this.drainMessages()
    if (this.consumer) {
      yield this.channel.cancel(this.consumer.consumerTag)
    }
    log.trace({queue: this.queueName}, 'Closing RabbitMQ connection')
    this.stopped = true
    if (this.channel) yield this.channel.close()
    if (this.connection) yield this.connection.close()
  }
}

module.exports = RabbitQueue
