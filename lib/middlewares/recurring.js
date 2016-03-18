"use strict"

var Mongo = require('./mongo')
var co = require('co')
var shortid = require('shortid')

class Recurring extends Mongo {
  constructor(options) {
    super(options)

    this.defineMandatoryDependency('in_queue', 'inQueue', this.service)
    this.defineMandatoryDependency('lock_manager', 'lockManager', this.service)

    const FIVE_SECONDS = 5 * 1000
    const ONE_MINUTE = 60 * 1000
    this.pollingIntervalMillis = this.params.pollingIntervalMillis || FIVE_SECONDS
    this.schedulingThresholdMillis = this.params.schedulingThresholdMillis || ONE_MINUTE
    this.lockResourceId = `${this.service.name}_recurring_scheduling_lock`
    this.collectionName = `${this.service.name}_recurring`
  }

  *initialize() {
    yield *super.initialize()

    this.collection = this.db.collection(this.collectionName)
    yield this.collection.createIndex(
      {recurringMessageId: 1},
      {unique: true, name: "recurringMessageId"}
    )
    yield this.collection.createIndex(
      {nextAt: 1},
      {unique: false, name: "nextAt"}
    )
  }

  *register(msg) {
    var now = Date.now()
    var record = {
      _id: msg.messageType,     // prevent registering multiple messages of the same type
      recurringMessageId: shortid.generate(),
      message: msg,
      registeredAt: now,
      nextAt: now,
      prevAt: null,
    }
    var existingMsg = yield this.collection.findOneAsync({_id: msg.messageType})
    if (existingMsg) {
      return yield this.collection.updateOneAsync({_id: msg.messageType}, {
        message: msg
      })
    }
    yield this.collection.insertAsync(record)
  }

  *unregister(recurringMessageId) {
    yield this.collection.deleteOneAsync({"recurringMessageId": recurringMessageId})
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

  *getDueMessages() {
    const MAX_ITEMS = 100

    return yield this.collection
      .find({ nextAt: { $lt: Date.now() } })
      .sort({ nextAt: 1 })
      .limit(MAX_ITEMS)
      .toArrayAsync()
  }

  *scheduleNextRun(recurringMsg) {
    var interval = recurringMsg.message.deliverEveryMillis
    var prevAt = Date.now()
    var nextAt = Date.now() + interval

    yield this.collection.updateOneAsync(
      { _id: recurringMsg._id },
      { $set: { prevAt: prevAt, nextAt: nextAt } }
    )
  }

  *schedulePending() {
    var lock = yield this.lockManager.tryAcquire(this.lockResourceId)
    if (!lock) return

    var dueMessages = yield this.getDueMessages()
    for (var msg of dueMessages) {
      msg.message.messageId = `msg_${shortid.generate()}`
      msg.message.recurringMessageId = msg.recurringMessageId
      yield this.inQueue.enqueue(msg.message)
      yield this.scheduleNextRun(msg)
    }

    yield this.lockManager.release(lock)
  }

  *start() {
    var boundSchedulePending = this.schedulePending.bind(this)
    yield this.schedulePending()
    this.intervalId = setInterval(function() {
      co(boundSchedulePending)
        .catch(_ => log.error(_))
    }, this.pollingIntervalMillis)
  }

  *stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
    }
  }
}

module.exports = Recurring
