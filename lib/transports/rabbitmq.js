"use strict"

var Transport = require('./transport')
var amqp = require('amqplib');

class RabbitTransport extends Transport {
  constructor(url) {
    super(url, 5672)
  }

  *enqueue(queue, msg) {
    this.channel.publish('', queue, new Buffer(JSON.stringify(msg)))
  }

  *initialize() {
    var auth = ""
    if (this.url.auth) auth = this.url.auth + "@"
    var amqpUrl = `amqp://${auth}${this.host}:${this.port}`
    console.log(`Connecting to ${amqpUrl}`)
    try{
      this.connection = yield amqp.connect(amqpUrl)
      this.channel = yield this.connection.createChannel()
      console.log(`Connected to ${amqpUrl}`)
    }
    catch (ex) {
      console.log("Failure")
      console.log(ex)
    }
  }
}

module.exports = RabbitTransport
