"use strict"

var Promise = require("bluebird");
Promise.promisifyAll(require("redis"));
var redis = require('redis')
var _ = require('lodash')
var Transport = require('./transport')

class RedisTransport extends Transport {
  constructor(url) {
    super(url, 6379)
    this.db = 0
  }

  *destroyAll(service) {
    yield this.client.delAsync(this.processingEntity(service))
  }

  *startProcessing(service, msg) {
    yield this.client.hsetAsync(this.processingEntity(service),
      msg.id, JSON.stringify(msg))
  }
  *stopProcessing(service, msg) {
    yield this.client.hdelAsync(this.processingEntity(service), msg.id)
  }
  *deleteProcessing(service, msgId) {
    return yield this.stopProcessing(service, {id: msgId})
  }

  *getProcessing(service) {
    var key = this.processingEntity(service)
    var result = yield [
      this.client.hgetallAsync(key),
      this.client.hlenAsync(key)
    ]
    var messages = result[0]
    var total = result[1]

    return  {
      stats: { total: total || 0 },
      messages: _.map(messages, JSON.parse)
    }
  }

  *initialize() {
    var url = `${this.host}:${this.port}/${this.db}`
    console.log(`Connecting to ${url}`)
    try{
      var client = redis.createClient(this.port, this.host)
      yield new Promise(function(resolve, reject) {
        client.on("ready", resolve)
        client.on("error", reject)
      })
      this.client = client
      console.log(`Connected to ${url}`)
    }
    catch (ex) {
      console.log("Error connecting to Redis")
      throw ex
    }
  }
}

module.exports = RedisTransport
