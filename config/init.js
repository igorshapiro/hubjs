var bunyan = require('bunyan')
global.log = bunyan.createLogger({
  name: "service_hub", 
  serializers: bunyan.stdSerializers
})

module.exports = function() {}
