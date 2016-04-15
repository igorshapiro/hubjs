"use strict"

var RabbitQueue = require('./rabbit_queue')
var _ = require('lodash')

class OutQueue extends RabbitQueue {
  constructor(options) {
    super(_.merge(options, {
      queueName: `${options.service.name}_out`
    }))
    this.defineMandatoryDependency('in_queue', ':service_in')
    this.defineOptionalDependency('bulk', ':service_bulk')
  }

  *buildExchange(msgType) {
    yield this.channel.assertExchange(msgType, 'fanout')

    var subscriberQueues = this.hub.getSubscribersOf(msgType)
      .map((sub) => this.getDependency(':service_in', sub))
      .map(_ => _.queueName)
    var bulkSubscriberQueues = this.hub.getBulkSubscribersOf(msgType)
      .map((sub) => this.getDependency(':service_bulk', sub))
      .map((sub) => sub.getQueueNameFor(msgType))
    var allQueues = subscriberQueues.concat(bulkSubscriberQueues)
    log.trace(`Binding queues ${allQueues} to exchange ${msgType}`)
    return yield allQueues.map(_ => this.channel.bindQueue(_, msgType, ''))
  }

  *initialize() {
    yield *super.initialize()
    yield this.service.publishes.map(_ => this.buildExchange(_))
  }
}

module.exports = OutQueue
