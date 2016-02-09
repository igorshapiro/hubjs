"use strict"

var Middleware = require('./middleware')
var request = require('request')

class Delivery extends Middleware {
  constructor(options) {
    super(options)
  }

  *handle(msg) {
    var response = yield request.postAsync({
      url: this.service.buildEndpointUrl(msg),
      json: true,
      data: msg
    })
  }
}

Delivery.isPerService = true

module.exports = Delivery
