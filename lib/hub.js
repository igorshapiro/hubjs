require('../config/init')
var route = require('koa-route')
var koa = require('koa')
var bodyParser = require('koa-bodyparser')
var rest = require('restler')
var ServicesRepository = require('./services_repository')

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
  options.manifestUrl = options.manifestUrl || "file://servises.json"
  var _hub = this

  var app = koa()
  app.use(bodyParser())
  app.use(route.post('/api/v1/messages', function*() {
    var msg = this.request.body
    msg.maxAttempts = msg.maxAttempts || 5
    msg.attemptsMade = msg.attemptsMade || 0
    yield _hub.repo
      .getPublisherOf(msg)
      .enqueueOutgoing(msg)
    this.status = 201
  }))

  function *startServices() {
    _hub.repo = new ServicesRepository(options.manifest || options.manifestUrl)
    yield _hub.repo.initialize()
  }

  this.start = function*() {
    yield *startServices()

    app.listen(options.port)
    console.log(`Listening on port ${options.port}`)
  }
}
