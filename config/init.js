require('number-timespans')

global.config = require('./config')
if (config.newrelic) require('newrelic')

var bunyan = require('bunyan')
global.log = bunyan.createLogger({
  name: "service_hub",
  serializers: bunyan.stdSerializers,
  streams: [
    { path: __dirname + '/../hub.log' },
    { stream: process.stdout }
  ]
})
var StatsD = require('node-statsd')
global.stats = new StatsD()
