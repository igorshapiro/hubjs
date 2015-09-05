var URL = require('url')
var mongo = require('mongojs');
var _ = require('lodash')

module.exports = function(url) {
  var url = URL.parse(url)
  var port = url.port || 27017
  var dbName = url.path.slice(1)
  var _this = this

  function deadCollection(svc) {
    return _this.db.collection(svc.name + "_dead")
  }

  this.destroyAll = function*(svc) {
    yield new Promise(function(resolve, reject) {
      deadCollection(svc).drop(function(err) {
        // if (err) reject(err)
        resolve()
      })
    })
  }

  this.deleteDeadMessage = function*(service, msg) {
    yield new Promise(function(resolve, reject) {
      deadCollection(service).remove({id: msg.id}, function(err, data) {
        if (err) return reject(err)
        resolve(data)
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

  var co = require('co')
  this.getDeadMessages = function*(service, page, pageSize) {
    page = page || 1
    pageSize = pageSize || 25
    var skipMsgs = pageSize * (page - 1)
    // console.log(service)
    var msgsAndStats = yield [
      new Promise(function(resolve, reject) {
        deadCollection(service).find({}).limit(pageSize).skip(skipMsgs, function(err, data) {
          if (err) return reject(err)
          resolve(data)
        })
      }),
      new Promise(function(resolve, reject) {
        deadCollection(service).stats(function(err, data) {
          if (err) return resolve({count: 0})
          resolve(data)
        })
      })
    ]
    var messages = _.each(msgsAndStats[0], function(x) { delete x._id})
    var collectionStats = msgsAndStats[1]
    return {
      stats: {total: collectionStats.count},
      messages: messages
    }
  }

  this.initialize = function*() {
    var auth = ""
    var mongoUrl = auth + url.hostname + ":" + port + "/" + dbName
    console.log("Connecting to " + mongoUrl)
    try{
      this.db = mongo(mongoUrl)
      console.log("Connected to " + mongoUrl)
    }
    catch (ex) {
      console.log("Failure")
      console.log(ex)
    }
  }
}
