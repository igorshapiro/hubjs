"use strict"

var Bluebird = require('bluebird')
Bluebird.config({
  longStackTraces: true,
  warnings: true
})
var WebServer = require('./../lib/middlewares/web_server')

module.exports = {
  newrelic: false,
  msgDefaults: {
    maxAttempts: 5,
    env: "default",
    attemptDelays: [ (5).seconds(), (3).minutes(), (30).minutes(), (6).hours() ]
  },
  middlewares: [
    { type: WebServer, params: { port: 8080 } }
  ]
}
