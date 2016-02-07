"use strict"

var Transport = require('./transport')
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
  }

  *initialize() {
    var auth = this.url.auth ? (this.url.auth + "@") : ""
    var amqpUrl = `amqp://${auth}${this.host}:${this.port}`
    this.connection = yield amqp.connect(amqpUrl)
    this.channel = yield this.connection.createChannel()

    yield this.channel.assertQueue(this.queueName)

    if (this.handler) {
      this.channel.consume(this.queueName, qmsg => {
        if (!qmsg) return

        var msg = JSON.parse(qmsg.content.toString())
        log.trace({queue: this.queueName, message: msg})
        co(function*() {
          try {
            yield this.handler.handle(msg)
          }
          catch (err) {
            log.error(err)
          }
          finally {
            this.channel.ack(qmsg)
          }
        }.bind(this))
      })
    }
  }

  *enqueue(msg) {
    this.channel.publish('', this.queueName, new Buffer(JSON.stringify(msg)))
  }

  *purge() {
    yield this.channel.deleteQueue(this.queueName)
  }

  *stop() {
    yield this.channel.close()
    yield this.connection.close()
  }
}

module.exports = RabbitQueue
