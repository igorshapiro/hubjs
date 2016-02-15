"use strict"

var Middleware = require('./middleware')
var request = require('request')

class Delivery extends Middleware {
  constructor(options) {
    super(options)

    this.defineOptionalDependency('error_handler', 'errorHandler', this.service)
    this.defineOptionalDependency('stats_reporter', 'stats')
  }

  *handle(msg) {
    var startedAt = Date.now()
    var response = yield request.postAsync({
      url: this.service.buildEndpointUrl(msg),
      json: true,
      data: msg
    })
    var responseTimeMillis = Date.now() - startedAt

    var category = response.statusCode / 100
    // 2xx is good for us. Handling is over
    if (category === 2) {
      if (this.stats) {
        this.stats.timing(msg, this.service, 'response_time', responseTimeMillis)
        this.stats.increment(msg, this.service, 'succeeded')
      }
      return
    }
    if (category === 5 || category === 4) {
      if (this.stats) this.stats.increment(msg, this.service, 'failed')
      yield this.errorHandler.handle(this.service, response, msg)
    }
  }
}

Delivery.isPerService = true

module.exports = Delivery
