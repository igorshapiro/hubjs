"use strict"

var Middleware = require('./middleware')
var Router = require('koa-router')

class API extends Middleware {
  constructor(options) {
    super(options)

    this.needs = { 'web_server': 'webServer' }
    this.router = Router()
  }

  *initialize() {
    this.router.post('/api/v1/messages', function*() {
      this.status = 204
    })
    this.webServer.app
      .use(this.router.routes())
      .use(this.router.allowedMethods())
  }

  *start() {
  }
}

module.exports = API
