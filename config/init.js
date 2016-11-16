require('number-timespans')
let path = require('path')

global.Middleware = require('./../lib/middlewares/middleware')

global.config = require('./config')

var bunyan = require('bunyan')
global.log = bunyan.createLogger({
  name: 'service_hub',
  serializers: bunyan.stdSerializers,
  level: 'info',
  streams: [
    { path: path.join(__dirname, '/../hub.log') },
    { stream: process.stdout }
  ]
})
// var StatsD = require('node-statsd')
// global.stats = new StatsD()
