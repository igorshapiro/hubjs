"use strict"

require('./../../config/init')
var shortid = require('shortid')
var Hub = require('./../../lib/hub/hub')

var request = require('request')
var nock = require('nock')

var Bluebird = require('bluebird')
Bluebird.promisifyAll(request)

class SubscriberBuilder {
  constructor(scenario, msgType, options) {
    this.baseUrl = "http://localhost"
    this.scenario = scenario
    this.msgType = msgType
    this.options = options || {}
  }

  withConcurrency(concurrency) {
    this.concurrency = concurrency
    return this
  }
  withResponseTaking(ms) {
    this.responseTaking = ms
    return this
  }

  at(path) {
    this.path = path
    return this.scenario
  }

  buildManifest() {
    var manifest = {
      subscribes: [this.msgType],
    }
    if (this.options.retrySchedule) {
      manifest.retrySchedule = this.options.retrySchedule
    }
    if (this.path) {
      manifest.endpoint = `${this.baseUrl}${this.path}`
        .replace(':type', this.msgType)
    }

    if (this.concurrency) manifest.concurrency = this.concurrency

    return manifest
  }
}

class ScenarioBuilder {
  constructor() {
    this.basePort = 8080
    this.hubBase = `http://localhost:${this.basePort}`
    this.hubs = []
    this.testPromise = new Promise((resolve, reject) => {
      this.resolveFunction = resolve
      this.rejectFunction = reject
    })
    this.requestsMade = []
  }

  forHub(options) {
    this.options = options || {}
    return this
  }

  withSubscriber(msgType, options) {
    return this.subscriber = new SubscriberBuilder(this, msgType, options)
  }

  whenSendingMessage(msg, options) {
    this.message = msg
    this.messageOptions = options || {}
    return this
  }

  itIsReceivedAt(path, options) {
    this.receivingPath = path
    this.receivingOptions = options || {}
    return this
  }

  after(ms) {
    this.afterMillis = ms
    return this
  }

  withinSchedule() {
    this.requestsSchedule = Array.prototype.slice.call(arguments)
    return this
  }

  buildManifest() {
    var publisher = {
      publishes: [this.subscriber.msgType]
    }
    var pubName = shortid.generate()

    var subscriber = this.subscriber.buildManifest()
    var subName = shortid.generate()

    var manifest = {}
    manifest[pubName] = publisher
    manifest[subName] = subscriber

    return manifest
  }

  *sendMessages() {
    var messagesEndpoint = `${this.hubBase}/api/v1/messages`
    var times = this.messageOptions.times || 1
    for (var i = 0; i < times; i++) {
      var response = yield request.postAsync({
        url: messagesEndpoint,
        json: true,
        body: this.message
      })

      var status = response.statusCode
      if (status !== 204) throw new Error(
        `POST ${messagesEndpoint} responded with ${status}`
      )
    }
  }

  *setupMocks() {
    var sub = this.subscriber
    nock(this.subscriber.baseUrl)
      .post(this.receivingPath)
      .reply(this.subscriber.options.status || 200, (uri, body) => {
        this.requestsMade.push({
          uri: uri, body: body, ts: Date.now()
        })
      })
      .log(_ => log.error(_))
  }

  checkAssertions() {
    var requests = this.requestsMade
    var schedule = this.requestsSchedule

    // Handle the `after` constraint
    var timePassed = Date.now() - this.testStartTS
    if (timePassed < this.afterMillis) return

    // Check schedule
    if (schedule && schedule.length) {
      var threshold = 50
      if (requests.length !== schedule.length) return
      var scheduleRanges = schedule
        .map(_ => [testStartTS + _, testStartTS + _ + threshold])
      for (var i = 0; i < scheduleRanges.length; i++) {
        var requestTS = requests[i].ts
        var range = scheduleRanges[i]
        var fallsInRange = range[0] <= requestTS && requestTS <= range[1]
        if (!fallsInRange) this.rejectFunction()
      }
      this.resolveFunction()
    }

    // Check simple requests count
    var expectedRequestsCount = this.receivingOptions.times || 1
    if (requests.length === expectedRequestsCount) {
      this.resolveFunction()
    }
  }

  *runTests() {
    this.testStartTS = Date.now()
    this.checkAssertionsInterval = setInterval(() => this.checkAssertions(), 50)
    return this.testPromise
  }

  buildConfig(options) {
    var WebServer = require('./../../lib/middlewares/web_server')
    var API = require('./../../lib/middlewares/api')
    var OutQueue = require('./../../lib/middlewares/out_queue')
    var Dispatcher = require('./../../lib/middlewares/dispatcher')
    var InQueue = require('./../../lib/middlewares/in_queue')
    var Delivery = require('./../../lib/middlewares/delivery')
    // Used for launching multiple hub instances
    var port = this.basePort + (options.instanceNumber || 0)
    return {
      middlewares: [
        { type: WebServer, params: { port: port } },
        { type: API },
        { type: OutQueue },
        { type: Dispatcher },
        { type: InQueue },
        { type: Delivery },
      ]
    }
  }

  *run() {
    var manifest = this.buildManifest()
    console.log(manifest)
    var numInstances = this.options.instances || 1
    this.hubs = []
    for (var i = 0; i < numInstances; i++) {
      var hub = new Hub({
        manifest: manifest,
        config: this.buildConfig({instanceNumber: i})
      })
      // console.log(hub.services)
      this.hubs.push(hub)
    }
    yield this.hubs.map(_ => _.run())
    yield this.setupMocks()
    yield this.sendMessages()
    return yield this.runTests()
  }

  *reset() {
    yield this.hubs.map(_ => _.purge())
    yield this.hubs.map(_ => _.stop())
    this.hubs = []
    if (this.checkAssertionsInterval)
      clearInterval(this.checkAssertionsInterval)
  }
}

module.exports = function() {
  return new ScenarioBuilder()
}
