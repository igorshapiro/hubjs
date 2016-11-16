var Middleware = require('./middleware')
var StatsD = require('node-statsd')

class StatsReporter extends Middleware {
  constructor(options) {
    super(options)
    this.statsd = new StatsD()
  }

  generateNames(msg, service, suffix) {
    var msgType = msg.messageType
    var names = [
      `hub.messages.${suffix}`,
      `hub.messages.${msgType}.${suffix}`
    ]
    if (service) {
      var svcName = service.name
      names.push(`hub.services.${svcName}.messages.${suffix}`)
      names.push(`hub.services.${svcName}.messages.${msgType}.${suffix}`)
    }
    return names
  }

  gauge(name, value) {
    this.statsd.gauge(name, value)
  }

  increment(msg, service, suffix, number) {
    this.statsd.increment(this.generateNames(msg, service, suffix), number || 1)
  }

  timing(msg, service, suffix, time) {
    this.statsd.timing(this.generateNames(msg, service, suffix), time)
  }
}

module.exports = StatsReporter
