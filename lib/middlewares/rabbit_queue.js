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
  }

  *initialize() {
    console.log(`Connecting to ${this.rawUrl}`)
    var auth = this.url.auth ? (this.url.auth + "@") : ""
    var amqpUrl = `amqp://${auth}${this.host}:${this.port}`
    this.connection = yield amqp.connect(amqpUrl)
    this.channel = yield this.connection.createChannel()
    this.queueName = `${this.service.name}_out`

    yield this.channel.assertQueue(this.queueName)
  }

  *enqueue(msg) {
    this.channel.publish('', this.queueName, new Buffer(JSON.stringify(msg)))
  }
}

module.exports = RabbitQueue
