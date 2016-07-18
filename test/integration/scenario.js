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
    var messageTypeSpec = this.msgType
    if (this.options.bulk) {
      messageTypeSpec = `${this.msgType}@${this.options.bulk}`
    }

    var manifest = {
      subscribes: [messageTypeSpec],
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
    this.messages = []
  }

  forHub(options) {
    this.options = options || {}
    return this
  }

  withSubscriber(msgType, options) {
    return this.subscriber = new SubscriberBuilder(this, msgType, options)
  }

  whenRegisteringRecurringMessage(msg, options) {
    this.recurringMsg = msg
    this.recurringMsgOptions = options
    return this
  }

  whenSendingMessage(msg, options) {
    if (!options) options = {}
    this.messages.push({msg, options})
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
    this.pubName = shortid.generate()

    var subscriber = this.subscriber.buildManifest()
    this.subName = shortid.generate()

    var services = {}
    services[this.pubName] = publisher
    services[this.subName] = subscriber
    var manifest = { services: services }

    return manifest
  }

  *registerRecurringMessages() {
    if (!this.recurringMsg) return

    var recurringEndpoint = `${this.hubBase}/api/v1/services/${this.subName}/recurring`
    var response = yield request.postAsync({
      url: recurringEndpoint,
      json: true,
      body: this.recurringMsg
    })

    this.handleAPICallError(recurringEndpoint, response)
  }

  *sendMessages() {
    if (!this.messages) return

    for (var m of this.messages) {
      var messagesEndpoint = `${this.hubBase}/api/v1/messages`
      var times = m.options.times || 1
      for (var i = 0; i < times; i++) {
        var response = yield request.postAsync({
          url: messagesEndpoint,
          json: true,
          body: m.msg
        })
      }
      this.handleAPICallError(messagesEndpoint, response)
    }
  }

  handleAPICallError(endpoint, response) {
    var status = response.statusCode
    if (status !== 201) throw new Error(
      `POST ${endpoint} responded with ${status}:\r\n${response.body}`
    )
  }

  *setupMocks() {
    const maxRequests = 1e6
    const me = this
    const status = this.subscriber.options.status || 200
    var sub = this.subscriber
    var req = nock(this.subscriber.baseUrl)
      .filteringRequestBody((body) => {
        this.requestsMade.push({ body: body, ts: Date.now() })
        return body
      })
      .post(this.receivingPath)
      .times(maxRequests)
      .reply(status, function(uri, req, cb) {
        if (me.subscriber.responseTaking) {
          setTimeout(function() {
            cb(null, [status, "Delayed response"])
          }, me.subscriber.responseTaking)
        }
        else cb(null, [status, "Response"])
      })
      .log(_ => log.debug(_))
  }

  checkAssertions() {
    var requests = this.requestsMade
    var schedule = this.requestsSchedule

    // Handle the `after` constraint
    var timePassed = Date.now() - this.testStartTS
    if (this.afterMillis && timePassed < this.afterMillis) return

    // Check schedule
    if (schedule && schedule.length) {
      var threshold = 200, warmup = 200
      if (requests.length !== schedule.length) {
        if (this.afterMillis) {
          this.rejectFunction(new Error(`Expected ${schedule.length} requests, but received ${requests.length}`))
        }
        else {
          return
        }
      }
      var scheduleRanges = schedule.reduce((acc, delay, index) => {
        var last = acc[acc.length - 1]
        var range = last
          ? [this.testStartTS + delay, this.testStartTS + delay + threshold * index]
          : [this.testStartTS, this.testStartTS + delay + warmup]
        acc.push(range)
        return acc
      }, [])
      for (var i = 0; i < scheduleRanges.length; i++) {
        var requestTS = requests[i].ts
        var range = scheduleRanges[i]
        var fallsInRange = range[0] <= requestTS && requestTS <= range[1]
        if (!fallsInRange) {
          log.error({
            scheduleRanges: scheduleRanges.map(r => ({
              from: r[0], to: r[1],
              delta: r[1] - r[0], fromStart: r[0] - this.testStartTS
            })),
            requests: requests.map(r => ({ ts: r.ts, fromStart: r.ts - this.testStartTS })),
            startTS: this.testStartTS
          }, "Invalid request ranges")
          this.rejectFunction(
            `#${i} ${requestTS} doesn't fall in [${range[0]}..${range[1]}]`
          )
          return
        }
      }
      this.resolveFunction()
      return
    }

    var predicate = this.predicate || (() => {
      var expectedRequestsCount = this.receivingOptions.times || 1
      return {
        passed: requests.length === expectedRequestsCount,
        error: `Expected ${expectedRequestsCount}, but got ${requests.length}`
      }
    })

    var predicateResult = predicate(this)
    // Check simple requests count
    if (this.afterMillis) {
      if (predicateResult.passed) {
        this.resolveFunction()
      }
      else {
        this.rejectFunction(new Error(predicateResult.error))
      }
    }
    else if (predicateResult.passed) {
      this.resolveFunction()
    }
  }

  *runTests() {
    this.checkAssertionsInterval = setInterval(() => this.checkAssertions(), 50)
    return this.testPromise
  }

  buildConfig(options) {
    var WebServer = require('./../../lib/middlewares/web_server')
    var API = require('./../../lib/middlewares/api')
    var OutQueue = require('./../../lib/middlewares/out_queue')
    var InQueue = require('./../../lib/middlewares/in_queue')
    var Delivery = require('./../../lib/middlewares/delivery')
    var ErrorHandler = require('./../../lib/middlewares/error_handler')
    var Scheduler = require('./../../lib/middlewares/scheduler')
    var DeadLetter = require('./../../lib/middlewares/dead_letter')
    var ConcurrencyManager = require('./../../lib/middlewares/concurrency_manager')
    var LockManager = require('./../../lib/middlewares/lock_manager')
    var Recurring = require('./../../lib/middlewares/recurring')
    var Processing = require('./../../lib/middlewares/processing')
    var Archive = require('./../../lib/middlewares/archive')
    var Bulk = require('./../../lib/middlewares/bulk')

    // Used for launching multiple hub instances
    var port = this.basePort + (options.instanceNumber || 0)
    return {
      middlewares: [
        { type: WebServer, params: { port: port } },
        { type: API },
        { type: OutQueue },
        { type: InQueue },
        { type: Delivery },
        { type: Scheduler, params: { pollingIntervalMillis: 50 } },
        { type: ErrorHandler },
        { type: DeadLetter },
        { type: ConcurrencyManager, params: { pollingIntervalMillis: 100 } },
        { type: LockManager },
        { type: Recurring, params: { pollingIntervalMillis: 50 } },
        { type: Processing },
        { type: Archive },
        { type: Bulk }
      ]
    }
  }

  withPredicate(predicate) {
    this.predicate = predicate
    return this
  }

  *run(options) {
    var manifest = this.buildManifest()
    log.debug({ manifest: manifest }, "Manifest generated")
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
    this.testStartTS = Date.now()
    yield this.registerRecurringMessages()
    yield this.sendMessages()
    return yield this.runTests()
  }

  *reset() {
    this.messages = []
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
