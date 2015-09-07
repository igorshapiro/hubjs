var URL = require('url')
var Promise = require("bluebird");
var mongo = require('mongojs');
Promise.promisifyAll([
   require("mongojs/lib/collection"),
   require("mongojs/lib/database"),
   require("mongojs/lib/cursor")
]);
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
    try{
      yield deadCollection(svc).dropAsync()
    }
    catch (ex) {
      log.debug({msg: "Ignored exception", ex: ex})
    }
  }

  this.getDeadMessage = function*(service, msgId) {
    return yield deadCollection(service).findOneAsync({id: msgId})
  }

  this.deleteDeadMessage = function*(service, msgId) {
    yield deadCollection(service).removeAsync({id: msgId})
  }

  this.kill = function*(service, msg) {
    yield deadCollection(service).insertAsync(msg)
  }

  var co = require('co')
  this.getDeadMessages = function*(service, page, pageSize) {
    page = page || 1
    pageSize = pageSize || 25
    var skipMsgs = pageSize * (page - 1)
    try{
      var msgsAndStats = yield [
        deadCollection(service).find({}).limit(pageSize).skipAsync(skipMsgs),
        deadCollection(service).statsAsync()
      ]
    }
    catch (ex) {
      if (ex.message.indexOf('not found') != -1)
        return {stats: {total: 0}, messages: []}
      throw ex
    }
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
