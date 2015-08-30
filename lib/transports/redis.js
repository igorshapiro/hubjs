var URL = require('url')
var redis = require('redis')

module.exports = function(url) {
  var url = URL.parse(url)
  var port = url.port || 6379
  var host = url.host || "localhost"
  var db = 0
  var _this = this

  this.destroyAll = function*(service) {
    var key = `${service.name}_processing`
    yield new Promise(function(resolve, reject) {
      _this.client.del(key, function(err, data) {
        if (err) return reject(err)
        resolve()
      })
    })
  }

  this.startProcessing = function*(service, msg) {
    var key = `${service.name}_processing`
    yield new Promise(function(resolve, reject) {
      _this.client.hset(key, msg.id, JSON.stringify(msg), function(err, data) {
        if (err) return reject(err)
        resolve()
      })
    })
  }
  this.stopProcessing = function*(service, msg) {
    var key = `${service.name}_processing`
    yield new Promise(function(resolve, reject) {
      _this.client.hdel(key, msg.id, function(err, data) {
        if (err) return reject(err)
        resolve()
      })
    })
  }

  this.getProcessing = function*(service) {
    var key = `${service.name}_processing`
    var messages = yield new Promise(function(resolve, reject) {
      _this.client.hgetall(key, function(err, data) {
        if (err) return reject(err)
        resolve(data)
      })
    })
    var total = yield new Promise(function(resolve, reject) {
      _this.client.hlen(key, function(err, data) {
        if (err) return reject(err)
        resolve(data)
      })
    })

    return  {
      stats: { total: total || 0 },
      messages: _.map(messages, JSON.parse)
    }
  }

  this.initialize = function*() {
    console.log(`Connecting to ${host}:${port}/${db}`)
    try{
      var client = redis.createClient(port, host)
      yield new Promise(function(resolve, reject) {
        client.on("ready", resolve)
        client.on("error", reject)
      })
      this.client = client
      console.log(`Connected to ${host}:${port}/${db}`)
    }
    catch (ex) {
      console.log("Error connecting to Redis")
      throw ex
    }
  }
}
