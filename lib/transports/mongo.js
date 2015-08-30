var URL = require('url')
var mongo = require('mongojs');

module.exports = function(url) {
  var url = URL.parse(url)
  var port = url.port || 27017
  var dbName = url.path.slice(1)
  var _this = this

  function deadCollection(svc) {
    return _this.db.collection(`${svc.name}_dead`)
  }

  this.destroyAll = function*(svc) {
    yield new Promise(function(resolve, reject) {
      deadCollection(svc).drop(function(err) {
        // if (err) reject(err)
        resolve()
      })
    })
  }

  this.kill = function*(service, msg) {
    yield new Promise(function(resolve, reject) {
      deadCollection(service).insert(msg, function(err, data) {
        if (err) return reject(err)
        resolve(data)
      })
    })
  }

  this.getDeadMessages = function*(service) {
    return yield new Promise(function(resolve, reject) {
      deadCollection(service).find(function(err, data) {
        if (err) return reject(err)
        resolve(data)
      })
    })
  }

  this.initialize = function*() {
    var auth = ``
    var mongoUrl = `${auth}${url.hostname}:${port}/${dbName}`
    console.log(`Connecting to ${mongoUrl}`)
    try{
      this.db = mongo(mongoUrl)
      console.log(`Connected to ${mongoUrl}`)
    }
    catch (ex) {
      console.log("Failure")
      console.log(ex)
    }
  }
}
