"use strict"

var Middleware = require('./middleware')
var koaBody = require('koa-body')({ jsonLimit: '10mb' })
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
    this.defineMandatoryDependency('scheduler', ':service_scheduler')
    this.defineMandatoryDependency('dead_letter', ':service_dead')
    this.defineOptionalDependency('archive', ':service_archive')
    this.defineOptionalDependency('stats_reporter', 'stats')
  }

  outQueueName(svc) { return `${svc.name}_out` }

  normalizeMessage(msg) {
    msg.messageId = `msg_${shortid.generate()}`
    msg.id = msg.messageId
    msg.timestamp = Date.now()

    msg.messageType = msg.messageType || msg.type
    msg.type = msg.messageType
    delete msg.type

    return msg
  }

  *initialize() {
    var me = this
    this.router = this.webServer.router

    this.router.post('/api/v1/messages', koaBody, function*() {
      var msg = me.normalizeMessage(this.request.body)

      log.trace({msg: msg}, "Incoming regular message")
      var publisher = me.hub.getPublisherOf(msg)
      if (!publisher) {
        var msg = `Unknown publisher for message ${msg.messageType}`
        log.error(msg)
        this.body = msg
        return this.status = 400
      }

      if (this.stats) this.stats.increment(msg, publisher, 'published')

      yield me.getDependency(':service_out', publisher).publish(msg)

      me.emit('accepted', {
        msg: msg,
        service: publisher.name,
        source: this.req.connection.remoteAddress
      })
      this.body = msg.messageId
      return this.status = 201
    })

    this.router.get('/api/v1/services/:name/recurring', koaBody, function*() {
      var svc = validateService(me.hub, this, this.params.name)
      if (!svc) return

      var recurring = validateDependency(me, this, ':service_recurring', svc)
      if (!recurring) return

      var messages =  yield recurring.getMessages(this.params.page, this.params.size)
      return this.body = {
        messages: messages,
        meta: { total: messages.total }
      }
    })

    this.router.get('/api/v1/services/:name/schedule', koaBody, function*() {
      var svc = validateService(me.hub, this, this.params.name)
      if (!svc) return

      var scheduler = validateDependency(me, this, ':service_scheduler', svc)
      if (!scheduler) return

      var messages =  yield scheduler.getMessages(this.params.page, this.params.size)
      return this.body = {
        messages: messages,
        meta: { total: messages.total }
      }
    })

    this.router.get('/api/v1/services/:name/dead', koaBody, function*() {
      var svc = validateService(me.hub, this, this.params.name)
      if (!svc) return

      var deadLetter = validateDependency(me, this, ':service_dead', svc)
      if (!deadLetter) return

      var messages = yield deadLetter.getMessages(this.params.page, this.params.size)
      return this.body = {
        messages: messages,
        meta: { total: messages.total }
      }
    })

    this.router.put('/api/v1/services/:name/dead/:messageId', function*() {
      var svcName = this.params.name
      var svc = me.hub.getService(svcName)
      yield me.getDependency(':service_dead', svc)
        .reenqueue(this.params.messageId)
      return this.status = 204
    })

    this.router.put('/api/v1/services/:name/schedule/:scheduledMessageId', function*() {
      var svcName = this.params.name
      var svc = me.hub.getService(svcName)
      yield me.getDependency(':service_scheduler', svc)
        .scheduleNow(this.params.scheduledMessageId)
      return this.status = 204
    })

    this.router.delete('/api/v1/services/:name/dead/:messageId', function*() {
      var svcName = this.params.name
      var svc = me.hub.getService(svcName)
      yield me.getDependency(':service_dead', svc)
        .delete(this.params.messageId)
      return this.status = 204
    })

    this.router.delete('/api/v1/services/:name/schedule/:messageId', function*() {
      var svcName = this.params.name
      var svc = me.hub.getService(svcName)
      yield me.getDependency(':service_scheduler', svc)
        .delete(this.params.messageId)
      return this.status = 204
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
      return this.status = 201
    })

    this.router.delete('/api/v1/services/:name/recurring/:recurringMessageId', function*() {
      var svcName = this.params.name
      var svc = me.hub.getService(svcName)
      yield me.getDependency(':service_recurring', svc)
        .unregister(this.params.recurringMessageId)
      return this.status = 204
    })

    this.router.post('/api/v1/services/:name/archive', koaBody, function*() {
      var svcName = this.params.name
      var svc = me.hub.getService(svcName)
      if (svc === null) {
        this.body = `Invalid service ${svcName}`
        return this.status = 404
      }

      var fromTS = this.params.from
      var archive = me.getDependency(':service_archive', svc)
      yield archive.replay(new Date(fromTS))

      this.status = 200
    })
  }

  *start() {
  }
}

module.exports = API
