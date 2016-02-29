"use strict"

var Middleware = require('./middleware')
var Bluebird = require('bluebird')
var request = Bluebird.promisifyAll(require('request'))

class Delivery extends Middleware {
  constructor(options) {
    super(options)

    this.defineOptionalDependency('error_handler', 'errorHandler', this.service)
    this.defineOptionalDependency('stats_reporter', 'stats')
    this.defineOptionalDependency('processing', 'processing', this.service)
  }

  *deliverToService(msg) {
    return yield request.postAsync({
      url: this.service.buildEndpointUrl(msg),
      json: msg,
      forever:true
    })
  }

  *handleResponse(response, msg) {
    var category = Math.floor(response.statusCode / 100)
    // 2xx is good for us. Handling is over
    if (category === 2) {
      if (this.stats) this.stats.increment(msg, this.service, 'succeeded')
      return
    }
    if (category === 5 || category === 4) {
      if (this.stats) this.stats.increment(msg, this.service, 'failed')
      yield this.errorHandler.handle(response, this.service, msg)
    }
  }

  *handle(msg) {
    var processingHandle, responseTimeMillis = 0
    try {
      if (this.processing) {
        processingHandle = yield this.processing.register(msg)
      }
      var startedAt = Date.now()
      var response = yield this.deliverToService(msg)
      responseTimeMillis = Date.now() - startedAt
      yield this.handleResponse(response, msg)
    }
    catch (e) {
      if (this.stats) this.stats.increment(msg, this.service, 'failed')
      yield this.errorHandler.handle(e, this.service, msg)
    }
    finally {
      if (this.processing && processingHandle) {
        yield this.processing.unregister(processingHandle)
      }
      if (this.stats) {
        this.stats.timing(msg, this.service, 'response_time', responseTimeMillis)
      }
    }
  }
}

Delivery.isPerService = true

module.exports = Delivery
