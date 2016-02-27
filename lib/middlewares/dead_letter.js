"use strict"

var MongoMiddleware = require('./mongo')

class DeadLetter extends MongoMiddleware {
  constructor(options) {
    super(options)

    this.defineOptionalDependency('stats_reporter', 'stats')
    this.defineMandatoryDependency('in_queue', 'inQueue', this.service)

    this.collectionName = `${this.service.name}_dead`
  }

  *initialize() {
    yield* super.initialize()

    this.collection = this.db.collection(this.collectionName)
    yield this.collection.createIndex(
      {killedAt: 1},
      {unique: true, name: "killedAt"}
    )
    yield this.collection.createIndex(
      {messageId: 1},
      {unique: true, name: "messageId"}
    )
  }

  *delete(messageId) {
    yield this.collection.deleteOneAsync({"messageId": messageId})
  }

  *reenqueue(messageId) {
    var msg = yield this.collection.findOneAsync({messageId: messageId})
    msg.attemptsMade = 0
    yield this.inQueue.enqueue(msg)
    yield this.delete(messageId)
  }

  *kill(msg) {
    msg.killedAt = Date.now()
    yield this.collection.insertAsync(msg)

    if (this.stats) this.stats.increment(msg, this.service, 'killed')
  }

  *getMessages(page, pageSize) {
    var pageSize = pageSize || 50
    var page = page || 1
    var offset = (page - 1) * pageSize
    return yield this.collection.find({}).skip(offset).limit(pageSize).toArrayAsync()
  }
}

DeadLetter.isPerService = true

module.exports = DeadLetter
