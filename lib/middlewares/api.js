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
    this.defineMandatoryDependency('recurring', ':service_recurring')
    this.defineOptionalDependency('stats_reporter', 'stats')
    this.router = Router()
  }

  outQueueName(svc) { return `${svc.name}_out` }

  normalizeMessage(msg) {
    msg.messageId = `msg_${shortid.generate()}`
    msg.timestamp = Date.now()

    msg.messageType = msg.messageType || msg.type
    delete msg.type

    return msg
  }

  *initialize() {
    var me = this

    this.router.post('/api/v1/messages', koaBody, function*() {
      var msg = me.normalizeMessage(this.request.body)

      log.trace({msg: msg}, "Incoming regular message")
      var publisher = me.hub.getPublisherOf(msg)

      if (this.stats) this.stats.increment(msg, publisher, 'published')

      yield me.getDependency(':service_out', publisher).enqueue(msg)
      return this.status = 204
    })

    this.router.post('/api/v1/services/:name/recurring', koaBody, function*() {
      var msg = me.normalizeMessage(this.request.body)
      log.trace({msg: msg}, "Registering recurring message")

      var svcName = this.params.name
      var svc = me.hub.getService(svcName)
      yield me.getDependency(':service_recurring', svc).register(msg)
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
