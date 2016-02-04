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
      endpoint: this.path
    }
    if (this.concurrency) manifest.concurrency = this.concurrency

    return manifest
  }
}

class ScenarioBuilder {
  forHub(options) {
    this.options = options || {}
    this.basePort = 8080
    this.hubBase = `http://localhost:${this.basePort}`
    this.hubs = []
    this.testPromise = new Promise((resolve, reject) => {
      this.resolveFunction = resolve
      this.rejectFunction = reject
    })
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
    this.receivingOptions = options
    return this
  }

  within(ms) {
    this.withinTimes = [ms]
    return this
  }

  withinTimes(times) {
    this.withinTimes = times
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
      .reply(this.subscriber.options.status || 200, function(uri, body) {
        console.log("Hello")
      })
      .log(console.log)
  }

  *runTests() {
    this.testStartTS = Date.now()
    return this.testPromise
  }

  buildConfig(options) {
    var WebServer = require('./../../lib/middlewares/web_server')
    var API = require('./../../lib/middlewares/api')
    // Used for launching multiple hub instances
    var port = this.basePort + (options.instanceNumber || 0)
    return {
      middlewares: [
        { type: WebServer, params: { port: port } },
        { type: API },
      ]
    }
  }

  *run() {
    var manifest = this.buildManifest()
    var numInstances = this.options.instances || 1
    this.hubs = []
    for (var i = 0; i < numInstances; i++) {
      var hub = new Hub({
        manifest: manifest,
        config: this.buildConfig({instanceNumber: i})
      })
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
  }
}

module.exports = function() {
  return new ScenarioBuilder()
}
