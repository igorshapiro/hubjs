var URL = require('url')
var Promise = require("bluebird");
Promise.promisifyAll(require("redis"));
var redis = require('redis')
var _ = require('lodash')

module.exports = function(url) {
  var url = URL.parse(url)
  var port = url.port || 6379
  var host = url.host || "localhost"
  var db = 0
  var _this = this

  this.destroyAll = function*(service) {
    var key = service.name + "_processing"
    yield _this.client.delAsync(key)
  }

  this.startProcessing = function*(service, msg) {
    var key = service.name + "_processing"
    yield _this.client.hsetAsync(key, msg.id, JSON.stringify(msg))
  }
  this.stopProcessing = function*(service, msg) {
    var key = service.name + "_processing"
    yield _this.client.hdelAsync(key, msg.id)
  }
  this.deleteProcessing = function*(service, msgId) {
    return yield this.stopProcessing(service, {id: msgId})
  }

  this.getProcessing = function*(service) {
    var key = service.name + "_processing"
    var messages = yield _this.client.hgetallAsync(key)
    var total = yield _this.client.hlenAsync(key)

    return  {
      stats: { total: total || 0 },
      messages: _.map(messages, JSON.parse)
    }
  }

  this.initialize = function*() {
    console.log("Connecting to " + host + ":" + port + "/" + db)
    try{
      var client = redis.createClient(port, host)
      yield new Promise(function(resolve, reject) {
        client.on("ready", resolve)
        client.on("error", reject)
      })
      this.client = client
      console.log("Connected to " + host + ":" + port + "/" + db)
    }
    catch (ex) {
      console.log("Error connecting to Redis")
      throw ex
    }
  }
}
