"use strict"

var Middleware = require('./middleware')
var Router = require('koa-router')
var koaBody = require('koa-body')()
var shortid = require('shortid')

class API extends Middleware {
  constructor(options) {
    super(options)

    this.needs = {
      'web_server': 'webServer'
    }

    this.defineMandatoryDependency('out_queue', ':service_out')
    this.defineOptionalDependency('stats_reporter', 'stats')
    this.router = Router()
  }

  outQueueName(svc) { return `${svc.name}_out` }

  *initialize() {
    var me = this

    this.router.post('/api/v1/messages', koaBody, function*() {
      var msg = this.request.body
      msg.messageId = `msg_${shortid.generate()}`
      msg.timestamp = Date.now()

      msg.messageType = msg.messageType || msg.type
      delete msg.type

      log.trace({msg: msg}, "Incoming message")
      var publisher = me.hub.getPublisherOf(msg)

      if (this.stats) this.stats.increment(msg, publisher, 'published')

      yield me.getDependency(':service_out', publisher).enqueue(msg)
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
