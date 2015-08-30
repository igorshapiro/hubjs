var bunyan = require('bunyan')
global.log = bunyan.createLogger({
  name: "service_hub",
  serializers: bunyan.stdSerializers,
  streams: [{
    path: __dirname + '/../hub.log'
  }]
})
var StatsD = require('node-statsd')
global.stats = new StatsD()
module.exports = function() {}
