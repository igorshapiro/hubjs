"use strict"

var Middleware = require('./middleware')
var Router = require('koa-router')
var koaBody = require('koa-body')()
var shortid = require('shortid')
var _ = require('lodash')

function validateService(hub, context, serviceName) {
  var svc = hub.getService(serviceName)
  if (svc) return svc

  context.status = 404
  context.body = `Invalid service ${serviceName}`
}

function validateDependency(middleware, context, name, service) {
  var dep = middleware.getDependency(name, service)
  if (dep) return dep

  context.status = 418
  context.body = "Recurring module not enabled"
}

class API extends Middleware {
  constructor(options) {
    super(options)

    this.needs = {
      'web_server': 'webServer'
    }

    this.defineMandatoryDependency('out_queue', ':service_out')
    this.defineMandatoryDependency('recurring', ':service_recurring')
    this.defineMandatoryDependency('dead_letter', ':service_dead')
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

    this.router.get('/api/v1/services/:name/recurring', koaBody, function*() {
      var svc = validateService(me.hub, this, this.params.name)
      if (!svc) return

      var recurring = validateDependency(me, this, ':service_recurring', svc)
      if (!recurring) return

      return this.body = {
        messages: yield recurring.getMessages(this.params.page, this.params.size)
      }
    })

    this.router.get('/api/v1/services/:name/dead', koaBody, function*() {
      var svc = validateService(me.hub, this, this.params.name)
      if (!svc) return

      var deadLetter = validateDependency(me, this, ':service_dead', svc)
      if (!deadLetter) return

      return this.body = {
        messages: yield deadLetter.getMessages(this.params.page, this.params.size)
      }
    })

    this.router.get('/api/v1/services', function*() {
      return this.body = {
        services: _.map(me.hub.services, _ => ({
          name: _.name,
          subscribes: _.subscribes,
          publishes: _.publishes
        }))
      }
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
