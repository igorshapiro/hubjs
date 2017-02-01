var Middleware = require('./middleware')
var Bluebird = require('bluebird')
var request = Bluebird.promisifyAll(require('request'))

class Delivery extends Middleware {
  constructor(options) {
    super(options)

    this.defineOptionalDependency('error_handler', 'errorHandler', this.service)
    this.defineOptionalDependency('stats_reporter', 'stats')
    this.defineOptionalDependency('processing', 'processing', this.service)
    this.defineOptionalDependency('scheduler', 'scheduler', this.service)
  }

  *deliverToService(msg) {
    return yield request.postAsync({
      url: this.service.buildEndpointUrl(msg),
      json: msg,
      forever: true
    })
  }

  *handleResponse(response, msg) {
    var category = Math.floor(response.statusCode / 100)

    var headers = response.headers

    if (headers) {
      var retryAfter = headers['retry-after']
      if (retryAfter) {
        log.info({retryAfter}, 'Rescheduling')
        yield this.scheduler.scheduleRelative(msg, retryAfter * 1000)
        return
      }
    }

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
    let processingHandle
    let responseTimeMillis = 0
    try {
      if (this.processing) {
        processingHandle = yield this.processing.register(msg)
      }
      var startedAt = Date.now()
      var response = yield this.deliverToService(msg)
      responseTimeMillis = Date.now() - startedAt
      this.emit('delivered', {
        msg: msg,
        service: this.service.name,
        response: {
          millis: responseTimeMillis,
          status: response.statusCode,
          body: response.body
        }
      })

      yield this.handleResponse(response, msg)
    } catch (e) {
      this.emit('delivery_failed', {
        msg: msg,
        service: this.service.name,
        err: {
          millis: responseTimeMillis,
          message: e.message
        }
      })

      if (this.stats) this.stats.increment(msg, this.service, 'failed')
      yield this.errorHandler.handle(e, this.service, msg)
    } finally {
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
