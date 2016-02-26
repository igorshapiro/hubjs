"use strict"

var Bluebird = require('bluebird')
Bluebird.config({
  longStackTraces: true,
  // warnings: true
})
var WebServer = require('./../lib/middlewares/web_server')
var API = require('./../lib/middlewares/api')
var OutQueue = require('./../lib/middlewares/out_queue')
var Dispatcher = require('./../lib/middlewares/dispatcher')
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
var UI = require('hubjs-ui')

module.exports = {
  newrelic: false,
  middlewares: [
    { type: WebServer, params: { port: 8080 } },
    { type: API },
    { type: OutQueue },
    { type: Dispatcher },
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
    { type: UI }
  ]
}
