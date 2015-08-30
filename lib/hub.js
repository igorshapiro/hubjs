require('../config/init')
var route = require('koa-route')
var koa = require('koa')
var bodyParser = require('koa-bodyparser')
var rest = require('restler')
var ServicesRepository = require('./services_repository')
var random = require('./random')

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
  app.use(route.post('/api/v1/messages', function*() {
    var msg = this.request.body
    msg.id = yield random.hex(6)
    msg.maxAttempts = msg.maxAttempts || 5
    msg.attemptsMade = msg.attemptsMade || 0
    yield _hub.repo
      .getPublisherOf(msg)
      .enqueueOutgoing(msg)
    this.status = 201
    this.body = msg.id
  }))
  app.use(route.get('/api/v1/:service_name/processing', function*(service_name) {
    var service = _hub.repo.getService(service_name)
    if (!service) this.throw(404, `Invalid service ${service_name}`)
    this.body = yield service.getProcessingMessages()
  }))

  function *startServices() {
    _hub.repo = new ServicesRepository(options.manifest || options.manifestUrl)
    yield _hub.repo.initialize()
  }

  this.start = function*() {
    console.log("Starting servicehub")
    yield *startServices()

    app.listen(options.port)
    console.log(`Listening on port ${options.port}`)
  }

  this.hardReset = function*() {
    var serviceResets = _hub.repo.services.map(function(svc) {
      return svc.hardReset()
    })
    yield serviceResets
  }
}
