"use strict"

var _ = require('lodash')
var TransportPool = require('./transports/pool')
var co = require('co')
var Scheduler = require('./scheduler')

class Service {
  constructor(repo, manifest) {
    this.repo = repo
    this.name = manifest.name
    this.subscribes = manifest.subscribes || []
    this.publishes = manifest.publishes || []
    this.queue = manifest.queue || "rabbitmq://localhost/"
    this.intermediate = manifest.intermediate || "redis://localhost/0"
    this.endpoint = manifest.endpoint || "http://localhost:3100/:type"
    this.storage = manifest.storage || "mongo://localhost/sh_test"
    this.concurrency = manifest.concurrency || 100
    this.deliverToService = require('./deliver_to_service')(this)
  }

  buildEntityName(type) {
    return this.name + "_" + type
  }

  isSubscriberOf(type) {
    return _.includes(this.subscribes, type)
  }

  isPublisherOf(type) {
    return _.includes(this.publishes, type)
  }

  *enqueueOutgoing(msg) {
    yield this.queueTransport.enqueue(this.buildEntityName('out'), msg)
  }
  *enqueueInput(msg) {
    yield this.queueTransport.enqueue(this.buildEntityName('in'), msg)
  }

  *schedule(msg, dueTime) {
    if (dueTime instanceof Date) dueTime = dueTime.getTime()
    yield this.storageTransport.schedule(this, msg, dueTime)
  }

  *kill(msg) {
    yield this.storageTransport.kill(this, msg)
  }

  *deleteDeadMessage(msgId) {
    return yield this.storageTransport.deleteDeadMessage(this, msgId)
  }
  *reenqueueMessage(msgId) {
    var msg = yield this.storageTransport.getDeadMessage(this, msgId)
    yield this.storageTransport.deleteDeadMessage(this, msgId)
    yield this.enqueueInput(msg)
  }
  *getDeadMessages(page, pageSize) {
    return yield this.storageTransport.getDeadMessages(this, page, pageSize)
  }

  *deleteProcessingMessage(msgId) {
    return yield this.intermediateTransport.deleteProcessing(this, msgId)
  }
  *getProcessingMessages(page, pageSize) {
    return yield this.intermediateTransport.getProcessing(this, page, pageSize)
  }
  *startProcessing(msg) {
    yield this.intermediateTransport.startProcessing(this, msg)
  }
  *stopProcessing(msg) {
    yield this.intermediateTransport.stopProcessing(this, msg)
  }

  *enqueueToServices(msg) {
    for (var subscriber of this.repo.getSubscribersOf(msg)) {
      if (msg.deliverInMillis) {
        var dueTime = Date.now() + msg.deliverInMillis
        yield subscriber.schedule(msg, dueTime)
      }
      else
        yield subscriber.enqueueInput(msg)
    }
  }

  *handleMessages(queueType, handler) {
    var _this = this
    var response = yield this.channel.consume(this.buildEntityName(queueType), function(qmsg) {
      if (!qmsg) return

      var msg = JSON.parse(qmsg.content.toString())
      co(function*() {
        try {
          yield handler.bind(_this)(msg)
        }
        catch (err) {
          log.error({ err: err }, "Message handler failed")
        }
        finally {
          _this.channel.ack(qmsg)
        }
      })
      .catch(_ => log.error(_))
    })
    return response.consumerTag
  }

  *processQueues() {
    yield this.channel.prefetch(this.concurrency)
    this.inConsumerTag = yield this.handleMessages('in', this.deliverToService)
    this.outConsumerTag = yield this.handleMessages('out', this.enqueueToServices)
  }

  *startTransport() {
    yield this.channel.assertQueue(this.buildEntityName('in'))
    yield this.channel.assertQueue(this.buildEntityName('out'))
    yield this.processQueues()

    yield this.storageTransport.setupService(this)
    this.scheduler = new Scheduler(this, this.repo.options)
    yield this.scheduler.start()
  }

  *run() {
    this.queueTransport = yield TransportPool.get(this.queue)
    this.channel = this.queueTransport.channel
    this.intermediateTransport = yield TransportPool.get(this.intermediate)
    this.storageTransport = yield TransportPool.get(this.storage)
    yield this.startTransport()
  }

  *hardReset() {
    yield this.channel.cancel(this.inConsumerTag)
    yield this.channel.cancel(this.outConsumerTag)
    yield this.channel.deleteQueue(this.buildEntityName('in'))
    yield this.channel.deleteQueue(this.buildEntityName('out'))
    yield this.intermediateTransport.destroyAll(this)
    yield this.storageTransport.destroyAll(this)
    yield this.scheduler.stop()
    yield this.startTransport()
  }

  toJson() {
    return {
      id: this.name,
      name: this.name
    }
  }
}

module.exports = Service
