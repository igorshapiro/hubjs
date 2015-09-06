require('../config/init')
var route = require('koa-route')
var koa = require('koa')
var bodyParser = require('koa-bodyparser')
var rest = require('restler')
var ServicesRepository = require('./services_repository')
var shortid = require('shortid')
var _ = require('lodash')
var cors = require('koa-cors')

MAX_SOCKETS = 1000000
require('http').globalAgent.maxSockets = MAX_SOCKETS
require('https').globalAgent.maxSockets = MAX_SOCKETS

function *deliverMessage(msg) {
  return new Promise(function(resolve, reject) {
    rest.post("http://localhost:3100/something_done", this.request.body)
      .on('success', function(result, response) { resolve(response) })
      .on('fail', function(data, response) { reject(response) })
      .on('error', function(err, response) { reject(response) })
  })
}

module.exports = function(options) {
  options = options || {}
  options.port = options.port || 8080
  options.manifestUrl = options.manifestUrl || "./services.json"
  var _hub = this

  var app = koa()
  app.use(bodyParser())
  app.use(cors({origin: "*"}))
  app.use(route.post('/api/v1/messages', function*() {
    var msg = this.request.body
    msg.id = shortid.generate()
    msg.maxAttempts = msg.maxAttempts || 5
    msg.attemptsMade = msg.attemptsMade || 0
    msg.env = msg.env || "default"

    msg.messageType = msg.messageType || msg.type
    delete msg.type
    if (_.isEmpty(msg.messageType)) this.throw(400, "Message type not specified")

    yield _hub.repo
      .getPublisherOf(msg)
      .enqueueOutgoing(msg)
    this.status = 201
    this.body = msg.id
  }))
  app.use(route.post('/api/v1/messages/:service/dead/:id'), function*(service, id) {
    var svc = _hub.repo.getService(service)
    if (!svc) return this.throw(404, "Invalid service " + service)

    yield svc.reenqueueMessage(id)

    this.body = {}
  })
  app.use(route.delete('/api/v1/messages/:service/:storage/:id', function*(service, storage, id){
    var svc = _hub.repo.getService(service)
    if (!svc) return this.throw(404, "Invalid service " + service)

    switch(storage) {
      case "dead":
        this.query.reenqueue
          ? yield svc.reenqueueMessage(id)
          : yield svc.deleteDeadMessage(id)
        break
      default:
        yield svc.deleteProcessingMessage(id)
    }

    this.body = {}
  }))
  app.use(route.get('/api/v1/messages', function*() {
    var service = _hub.repo.getService(this.query.service)
    if (!service) return this.throw(404, "Invalid service " + this.query.service)

    var getter
    switch(this.query.type) {
      case "dead":
        getter = service.getDeadMessages
        break
      default:
        getter = service.getProcessingMessages
    }
    var messages = yield getter.apply(service, [this.query.page, this.query.pageSize])
    for (var i in messages.messages) {
      var msg = messages.messages[i]
      msg.raw = JSON.stringify(msg, null, 2)
    }
    messages.meta = messages.stats
    delete messages.stats
    this.body = messages
  }))

  app.use(route.get('/api/v1/:service_name/processing', function*(service_name) {
    var service = _hub.repo.getService(service_name)
    if (!service) this.throw(404, "Invalid service " + service_name)
    this.body = yield service.getProcessingMessages(
      this.query.page,
      this.query.pageSize
    )
  }))
  app.use(route.get('/api/v1/:service_name/dead', function*(service_name) {
    var service = _hub.repo.getService(service_name)
    if (!service) this.throw(404, "Invalid service " + service_name)
    this.body = yield service.getDeadMessages(
      this.query.page,
      this.query.pageSize
    )
  }))
  app.use(route.get('/api/v1/services', function*() {
    var services = _.map(_hub.repo.services, function(s) {
      return s.toJson()
    })
    this.body = {services: services}
  }))
  app.use(route.get('/api/v1/services/:name', function*(name) {
    var service = _hub.repo.getService(name)
    this.body = {service: service.toJson()}
  }))
  app.use(require('koa-static')("public"))

  function *startServices() {
    _hub.repo = new ServicesRepository(options.manifest || options.manifestUrl)
    yield _hub.repo.initialize()
  }

  this.start = function*() {
    console.log("Starting servicehub")
    yield *startServices()

    app.listen(options.port)
    console.log("Listening on port " + options.port)
  }

  this.hardReset = function*() {
    var serviceResets = _hub.repo.services.map(function(svc) {
      return svc.hardReset()
    })
    yield serviceResets
  }
}
