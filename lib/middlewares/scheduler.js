"use strict"

var MongoMiddleware = require('./mongo')

class Scheduler extends MongoMiddleware {
  constructor(options) {
    super(options)
    this.collectionName = `${this.service.name}_schedule`
    this.needs[this.buildInstanceName('in_queue', this.service)] = 'inQueue'
  }

  *initialize() {
    yield* super.initialize()

    this.stopped = false
    this.collection = this.db.collection(this.collectionName)
  }

  *start() {
    const interval = 50
    this.intervalId = setInterval(
      this.handleScheduledMessages.bind(this),
      interval
    )
  }

  *stop() {
    if (this.intervalId) clearInterval(this.intervalId)
    this.stopped = true
  }

  handleScheduledMessages() {
    if (this.stopped) return

    co(this.doHandleScheduledMessages.bind(this))
      .catch(_ => log.error(_))
  }

  *getDueMessages() {
    const MAX_ITEMS = 100

    return yield this.collection
      .find({ dueTime: { $lt: Date.now() } })
      .sort({ dueTime: 1 })
      .limit(MAX_ITEMS)
      .toArrayAsync()
  }

  *doHandleScheduledMessages() {
    var dueMessages = yield this.getDueMessages()
    for (var msg of dueMessages) {
      yield this.inQueue.enqueue(msg.message)
      yield this.collection.deleteOneAsync({_id: msg._id})
    }
  }

  *schedule(msg, dueTime) {
    log.debug({
      dueTime: dueTime,
      msgId: msg.messageId,
      fromNowMillis: dueTime - Date.now()
    }, "Scheduling message")
    var scheduledItem = { dueTime: dueTime, message: msg }
    yield this.collection.insertAsync(scheduledItem)
  }
}

Scheduler.isPerService = true

module.exports = Scheduler
