"use strict"

var Transport = require('./transport')
var Bluebird = require('bluebird')
var _ = require('lodash')
var amqp = require('amqplib')

class RabbitQueue extends Transport {
  constructor(options) {
    super(_.merge(options, {
      defaultPort: 5672,
      defaultUrl: "rabbitmq://localhost",
      urlProperty: 'queue',
      protocol: 'rabbitmq'
    }))
    this.queueName = options.queueName
    this.messagesBeingHandled = 0
  }

  *initialize() {
    var auth = this.url.auth ? (this.url.auth + "@") : ""
    var amqpUrl = `amqp://${auth}${this.host}:${this.port}`
    this.connection = yield amqp.connect(amqpUrl)
    this.channel = yield this.connection.createChannel()

    yield this.channel.assertQueue(this.queueName)

    if (this.handler) {
      this.consumer = yield this.channel.consume(this.queueName, qmsg => {
        if (!qmsg) return
        if (this.stopped) return
        this.messagesBeingHandled++

        var msg = JSON.parse(qmsg.content.toString())
        log.debug({queue: this.queueName, message: msg})
        co(function*() {
          try {
            yield this.handler.handle(msg)
          }
          catch (err) {
            log.error(err, "Error processing message")
          }
          finally {
            var messageInfo = {
              tag: qmsg.fields.deliveryTag,
              queue: this.queueName,
              msgId: msg.messageId,
              consumer: this.consumer
            }
            log.trace(messageInfo, "Acknowledging RabbitMQ message")
            this.channel.ack(qmsg)
            this.messagesBeingHandled--
          }
        }.bind(this))
        .catch(_ => log.error(_))
      })
      log.trace({
        consumer: this.consumer,
        queue: this.queueName,
        instanceName: this.instanceName,
        serviceName: this.service.name
      }, "Created consumer")
    }
  }

  *enqueue(msg) {
    if (this.stopped) {
      log.error({msg: msg}, "Trying to enqueue message for stopped RabbitMQ")
    }
    this.channel.publish('', this.queueName, new Buffer(JSON.stringify(msg)))
  }

  *drainMessages() {
    log.trace({queue: this.queueName}, `Draining ${this.messagesBeingHandled} messages`)
    while (this.messagesBeingHandled) {
      yield Bluebird.delay(50)
    }
  }

  *purge() {
    yield this.channel.cancel(this.consumer.consumerTag)
    yield this.drainMessages()
    yield this.channel.deleteQueue(this.queueName)
  }

  *stop() {
    yield this.drainMessages()
    log.trace({queue: this.queueName}, "Closing RabbitMQ connection")
    this.stopped = true
    yield this.channel.close()
    yield this.connection.close()
  }
}

module.exports = RabbitQueue
