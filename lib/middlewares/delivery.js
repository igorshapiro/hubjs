"use strict"

var Middleware = require('./middleware')
var request = require('request')

class Delivery extends Middleware {
  constructor(options) {
    super(options)

    this.defineOptionalDependency('error_handler', 'errorHandler', this.service)
  }

  *handle(msg) {
    var response = yield request.postAsync({
      url: this.service.buildEndpointUrl(msg),
      json: true,
      data: msg
    })
    var category = response.statusCode / 100
    if (category === 2) return      // 2xx is good for us. Handling is over
    if (category === 5 || category === 4) {
      yield this.errorHandler.handle(this.service, response, msg)
    }
  }
}

Delivery.isPerService = true

module.exports = Delivery
