var Middleware = require('./middleware')
var koa = require('koa')
var Router = require('koa-router')
var http = require('http')

class WebServer extends Middleware {
  constructor(options) {
    super(options)

    this.port = this.params.port || 8080
    this.router = Router()
  }

  *initialize() {
    this.app = koa()
  }

  *start() {
    this.app
      .use(this.router.routes())
      .use(this.router.allowedMethods())

    log.trace('Starting HTTP listener')
    this.httpServer = http.createServer(this.app.callback())
    this.httpServer.listen(this.port)
  }

  *stop() {
    log.trace('Stopping HTTP listener')
    yield* super.stop()
    var server = this.httpServer
    if (!server) return
    return yield new Promise(function(resolve) {
      server.close(resolve)
    })
  }
}

module.exports = WebServer
