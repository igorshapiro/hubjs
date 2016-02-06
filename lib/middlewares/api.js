"use strict"

var Middleware = require('./middleware')
var Router = require('koa-router')
var koaBody = require('koa-body')()

var request = require('request')

class API extends Middleware {
  constructor(options) {
    super(options)

    this.needs = {
      'web_server': 'webServer'
    }
    this.hub.services.forEach((svc) => {
      this.needs[this.buildInstanceName('out_queue', svc)] = `${svc.name}_out`
    })
    this.router = Router()
  }

  outQueueName(svc) { return `${svc.name}_out` }

  *initialize() {
    var me = this

    this.router.post('/api/v1/messages', koaBody, function*() {
      var msg = this.request.body
      var publisher = me.hub.getPublisherOf(msg)
      var outQueue = me[me.outQueueName(publisher)]
      yield outQueue.enqueue(msg)
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
