"use strict"

var Redis = require('./redis')

class Processing extends Redis {
  constructor(options) {
    super(options)

    this.redisKey = `hub_${this.service.name}_processing`
  }

  *register(msg) {
    var handle = msg.messageId
    yield this.client.hsetAsync(this.redisKey, handle, JSON.stringify(msg))
    return handle
  }

  *unregister(handle) {
    yield this.client.hdelAsync(this.redisKey, handle)
  }
}

module.exports = Processing
