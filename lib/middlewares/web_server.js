"use strict"

var Middleware = require('./middleware')
var koa = require('koa')
var http = require('http')

class WebServer extends Middleware {
  constructor(options) {
    super(options)

    this.port = this.params.port || 8080
  }

  *initialize() {
    this.app = koa()
  }

  *start() {
    this.httpServer = http.createServer(this.app.callback())
    this.httpServer.listen(this.port)
  }

  *stop() {
    var server = this.httpServer
    return yield new Promise(function(resolve) {
      server.close(resolve)
    })
  }
}

module.exports = WebServer
