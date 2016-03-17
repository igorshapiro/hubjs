"use strict"

var RabbitQueue = require('./rabbit_queue')
var _ = require('lodash')

class OutQueue extends RabbitQueue {
  constructor(options) {
    super(_.merge(options, {
      queueName: `${options.service.name}_out`
    }))
    this.defineMandatoryDependency('in_queue', ':service_in')
  }

  *buildExchange(msgType, subscribers) {
    yield this.channel.assertExchange(msgType, 'fanout')

    return yield (this.hub.getSubscribersOf(msgType)
      .map((sub) => {
        var queueName = this.getDependency(':service_in', sub).queueName
        log.trace(`Binding queue ${queueName} to exchange ${msgType}`)
        return this.channel.bindQueue(queueName, msgType, '')
      }))
  }

  *initialize() {
    yield *super.initialize()
    yield this.service.publishes.map(_ => this.buildExchange(_))
  }
}

module.exports = OutQueue
