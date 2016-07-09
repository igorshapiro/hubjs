"use strict"

require('newrelic')
var Bluebird = require('bluebird')
Bluebird.config({
  longStackTraces: true,
  // warnings: true
})
var WebServer = require('./../lib/middlewares/web_server')
var API = require('./../lib/middlewares/api')
var OutQueue = require('./../lib/middlewares/out_queue')
var InQueue = require('./../lib/middlewares/in_queue')
var Delivery = require('./../lib/middlewares/delivery')
var ErrorHandler = require('./../lib/middlewares/error_handler')
var Scheduler = require('./../lib/middlewares/scheduler')
var DeadLetter = require('./../lib/middlewares/dead_letter')
var ConcurrencyManager = require('./../lib/middlewares/concurrency_manager')
var LockManager = require('./../lib/middlewares/lock_manager')
var StatsReporter = require('./../lib/middlewares/stats_reporter')
var Recurring = require('./../lib/middlewares/recurring')
var Processing = require('./../lib/middlewares/processing')
var Monitor = require('./../lib/middlewares/monitor')
var Inspector = require('./../lib/middlewares/inspector')
var Archive = require('./../lib/middlewares/archive')
var UI = require('hubjs-ui')

module.exports = {
  middlewares: [
    { type: WebServer, params: { port: 8080 } },
    { type: API },
    { type: OutQueue },
    { type: InQueue },
    { type: Delivery },
    { type: Scheduler },
    { type: ErrorHandler },
    { type: DeadLetter },
    { type: ConcurrencyManager },
    { type: LockManager },
    { type: StatsReporter },
    { type: Recurring },
    { type: Processing },
    { type: Monitor },
    { type: Inspector },
    { type: Archive, params: { secondsInChunk: 5 } },
    // { type: UI, params: { username: "hub", password: "hub" } }
  ]
}
