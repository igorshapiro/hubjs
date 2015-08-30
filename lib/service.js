var _ = require('lodash')
var TransportPool = require('./transports/pool')
var co = require('co')

module.exports = function(repo, manifest) {
  this.repo = repo
  this.name = manifest.name
  this.subscribes = manifest.subscribes || []
  this.publishes = manifest.publishes || []
  this.queue = manifest.queue || "rabbitmq://localhost/"
  this.intermediate = manifest.intermediate || "redis://localhost/0"
  this.endpoint = manifest.endpoint || "http://localhost:3100/:type"
  this.concurrency = manifest.concurrency || 100
  var _this = this

  function buildEntityName(type) {
    return `${_this.name}_${type}`
  }

  this.isSubscriberOf = function(type) {
    return _.includes(this.subscribes, type)
  }

  this.isPublisherOf = function(type) {
    return _.includes(this.publishes, type)
  }

  this.enqueueOutgoing = function*(msg) {
    yield this.queueTransport.enqueue(buildEntityName('out'), msg)
  }
  this.enqueueInput = function*(msg) {
    yield this.queueTransport.enqueue(buildEntityName('in'), msg)
  }

  this.deadMessages = []
  this.kill = function*(msg) {
    return this.deadMessages.push(msg)
    // yield this.storage.save(buildEntityName('dead'), msg)
  }

  this.getDeadMessages = function*() {
    return this.deadMessages
  }

  this.getProcessingMessages = function*() {
    return yield this.intermediateTransport.getProcessing(this)
  }
  this.startProcessing = function*(msg) {
    yield this.intermediateTransport.startProcessing(this, msg)
  }
  this.stopProcessing = function*(msg) {
    yield this.intermediateTransport.stopProcessing(this, msg)
  }

  function *enqueueToServices(msg) {
    for (var subscriber of _this.repo.getSubscribersOf(msg)) {
      yield subscriber.enqueueInput(msg)
    }
  }

  var deliverToService = require('./deliver_to_service')(this)

  function *handleMessages(queueType, handler) {
    var response = yield _this.channel.consume(buildEntityName(queueType), function(qmsg) {
      if (!qmsg) return

      var msg = JSON.parse(qmsg.content.toString())
      co(function*() {
        yield handler(msg)
        yield _this.channel.ack(qmsg)
      })
    })
    return response.consumerTag
  }

  function *processQueues() {
    yield _this.channel.prefetch(_this.concurrency)
    _this.inConsumerTag = yield handleMessages('in', deliverToService)
    _this.outConsumerTag = yield handleMessages('out', enqueueToServices)
  }

  function *startTransport() {
    yield _this.channel.assertQueue(buildEntityName('in'))
    yield _this.channel.assertQueue(buildEntityName('out'))
    yield processQueues()
  }

  this.run = function*() {
    this.queueTransport = yield TransportPool.get(this.queue)
    this.channel = this.queueTransport.channel
    this.intermediateTransport = yield TransportPool.get(this.intermediate)
    yield startTransport()
  }

  this.hardReset = function*() {
    yield this.channel.cancel(this.inConsumerTag)
    yield this.channel.cancel(this.outConsumerTag)
    yield this.channel.deleteQueue(buildEntityName('in'))
    yield this.channel.deleteQueue(buildEntityName('out'))
    yield this.intermediateTransport.destroyAll(this)
    yield startTransport()
  }
}
