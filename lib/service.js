var _ = require('lodash')
var TransportPool = require('./transports/pool')
var co = require('co')

module.exports = function(repo, manifest) {
  this.repo = repo
  this.name = manifest.name
  this.subscribes = manifest.subscribes || []
  this.publishes = manifest.publishes || []
  this.queue = manifest.queue || "rabbitmq://localhost/"
  this.endpoint = manifest.endpoint || "http://localhost:3100/:type"
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

  function *enqueueToServices(msg) {
    for (var subscriber of _this.repo.getSubscribersOf(msg)) {
      yield subscriber.enqueueInput(msg)
    }
  }

  var deliverToService = require('./deliver_to_service')(this)

  function handleMessages(queueType, handler) {
    _this.channel.consume(buildEntityName(queueType), function(qmsg) {
      var msg = JSON.parse(qmsg.content.toString())
      co(function*() {
        yield handler(msg)
        yield _this.channel.ack(qmsg)
      })
    })
  }

  function processQueues() {
    handleMessages('in', deliverToService)
    handleMessages('out', enqueueToServices)
  }

  this.run = function*() {
    this.queueTransport = yield TransportPool.get(this.queue)
    this.channel = this.queueTransport.channel
    yield this.channel.assertQueue(buildEntityName('in'))
    yield this.channel.assertQueue(buildEntityName('out'))
    processQueues()
  }
}
