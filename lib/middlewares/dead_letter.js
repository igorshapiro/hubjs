"use strict"

var MongoMiddleware = require('./mongo')

class DeadLetter extends MongoMiddleware {
  constructor(options) {
    super(options)

    this.defineOptionalDependency('stats_reporter', 'stats')
    this.defineMandatoryDependency('in_queue', 'inQueue', this.service)

    this.collectionName = `${this.service.name}_dead_v2`
  }

  *initialize() {
    yield* super.initialize()

    this.collection = this.db.collection(this.collectionName)
    yield this.collection.createIndex(
      {killedAt: 1},
      {name: "killedAt"}
    )
    yield this.collection.createIndex(
      {messageId: 1},
      {unique: true, name: "messageId"}
    )
  }

  *delete(messageId) {
    if (messageId === "all") {
      return yield this.collection.deleteManyAsync({})
    }
    yield this.collection.deleteOneAsync({"messageId": messageId})
  }

  *reenqueueAll() {
    var inQueue = this.inQueue
    do {
      var messages = yield this.getMessages()
      if (messages.length === 0) return

      var ids = messages.map(_ => _._id)
      for (var msg of messages) {
        msg.attemptsMade = 0
        yield inQueue.enqueue(msg)
      }
      yield this.collection.deleteManyAsync({ _id: { $in: ids}})
    } while (true)
  }

  *reenqueue(messageId) {
    if (messageId === "all") return yield this.reenqueueAll()

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
    var messages = yield this.collection.find({}).skip(offset).limit(pageSize).toArrayAsync()
    var stats = yield this.collection.statsAsync()
    messages.total = stats.count
    return messages
  }
}

DeadLetter.isPerService = true

module.exports = DeadLetter
