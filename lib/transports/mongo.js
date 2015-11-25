"use strict"

var co = require('co')
var Transport = require('./transport')
var Promise = require("bluebird")
var mongo = require('mongojs')
Promise.promisifyAll([
   require("mongojs/lib/collection"),
   require("mongojs/lib/database"),
   require("mongojs/lib/cursor")
]);
var _ = require('lodash')

class MongoTransport extends Transport {
  constructor(url) {
    super(url, 27017)
    this.dbName = this.url.path.slice(1)
  }

  deadCollection(svc) { return this.db.collection(this.deadEntity(svc)) }
  scheduleCollection(svc) { return this.db.collection(this.scheduledEntity(svc)) }

  *destroyAll(svc) {
    try{
      yield [
        this.deadCollection(svc).dropAsync(),
        this.scheduleCollection(svc).dropAsync()
      ]
    }
    catch (ex) {
      log.debug({msg: "Ignored exception", ex: ex})
    }
  }

  *schedule(service, msg, dueTime) {
    yield this.scheduleCollection(service).insertAsync({
      dueTime: dueTime,
      message: msg
    })
  }

  *getDueMessages(service, dueTime) {
    return yield this.scheduleCollection(service).findAsync({
      dueTime: {$lt: dueTime}
    })
  }

  *removeScheduledMessage(service, scheduledMsg) {
    yield this.scheduleCollection(service).removeAsync({
      _id: scheduledMsg._id
    })
  }

  *getDeadMessage(service, msgId) {
    return yield this.deadCollection(service).findOneAsync({id: msgId})
  }

  *deleteDeadMessage(service, msgId) {
    yield this.deadCollection(service).removeAsync({id: msgId})
  }

  *kill(service, msg) {
    yield this.deadCollection(service).insertAsync(msg)
  }

  *getDeadMessages(service, page, pageSize) {
    page = page || 1
    pageSize = pageSize || 25
    var skipMsgs = pageSize * (page - 1)
    try{
      var msgsAndStats = yield [
        this.deadCollection(service).find({}).limit(pageSize).skipAsync(skipMsgs),
        this.deadCollection(service).statsAsync()
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

  *initialize() {
    var auth = ""
    var mongoUrl = `${auth}${this.host}:${this.port}/${this.dbName}`
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

module.exports = MongoTransport
