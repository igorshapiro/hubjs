"use strict"

var Middleware = require('./middleware')
var Router = require('koa-router')
var koaBody = require('koa-body')()

var request = require('request')

class API extends Middleware {
  constructor(options) {
    super(options)

    this.needs = { 'web_server': 'webServer' }
    this.router = Router()
  }

  *initialize() {
    this.router.post('/api/v1/messages', koaBody, function*() {
      var msg = this.request.body
      yield request.postAsync({
        url: `http://localhost/handlers/${msg.type}`
      })
      return this.status = 204
    })
    this.webServer.app
      .use(this.router.routes())
      .use(this.router.allowedMethods())
  }

  *start() {
  }
}

module.exports = API
