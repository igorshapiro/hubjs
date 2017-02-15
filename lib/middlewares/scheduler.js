var MongoMiddleware = require('./mongo')
var shortid = require('shortid')

const FIVE_SECONDS = 5000

class Scheduler extends MongoMiddleware {
  constructor(options) {
    super(options)
    this.collectionName = `${this.service.name}_schedule`
    this.defineMandatoryDependency('in_queue', 'inQueue', this.service)
    this.defineMandatoryDependency('lock_manager', 'lockManager', this.service)
    this.defineOptionalDependency('stats_reporter', 'stats')
    this.lockResourceId = `${this.service.name}_schedule_lock`
    this.pollingIntervalMillis = this.params.pollingIntervalMillis || FIVE_SECONDS
  }

  *initialize() {
    yield* super.initialize()

    this.collection = this.db.collection(this.collectionName)
    yield this.collection.createIndex(
      {dueTime: 1},
      {unique: false, name: 'dueTime'}
    )
    yield this.collection.createIndex(
      {scheduledMessageId: 1},
      {unique: true, name: 'scheduledMessageId'}
    )
  }

  *intervalHandler() { yield this.doHandleScheduledMessages() }

  *getMessages(page, pageSize) {
    pageSize = pageSize || 50
    page = page || 1
    var offset = (page - 1) * pageSize
    var messages = yield this.collection.find({}).skip(offset).limit(pageSize).toArrayAsync()
    var stats = yield this.collection.statsAsync()
    messages.total = stats.count
    return messages
  }

  *delete(scheduledMessageId) {
    yield this.collection.deleteOneAsync({'scheduledMessageId': scheduledMessageId})
  }

  *scheduleNow(msg) {
    if (typeof msg === 'string') {
      msg = yield this.collection.findOneAsync({ scheduledMessageId: msg })
    }
    yield this.inQueue.enqueue(msg.message)
    yield this.collection.deleteOneAsync({_id: msg._id})
    this.emit('enqueued', {
      service: this.service.name,
      msg: msg.message,
      scheduledMessageId: msg.scheduledMessageId,
      timestamp: Date.now()
    })
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
    var lock
    try {
      lock = yield this.lockManager.tryAcquire(this.lockResourceId)
      if (!lock || this.stopped) return
      var dueMessages = yield this.getDueMessages()
      for (var msg of dueMessages) {
        yield this.scheduleNow(msg)
        if (this.stats) {
          this.stats.increment(msg.message, this.service, 'past_due')
        }
      }
    } finally {
      if (lock) yield this.lockManager.release(lock)
    }
  }

  *scheduleRelative(msg, dueTimeOffsetMillis) {
    yield this.schedule(msg, Date.now() + dueTimeOffsetMillis)
  }

  *schedule(msg, dueTime) {
    log.debug({
      dueTime: dueTime,
      msgId: msg.messageId,
      fromNowMillis: dueTime - Date.now()
    }, 'Scheduling message')
    var scheduledItem = {
      dueTime: dueTime,
      message: msg,
      scheduledMessageId: shortid.generate()
    }
    yield this.collection.insertAsync(scheduledItem)
    this.emit('scheduled', {
      msg: msg,
      dueTime: dueTime,
      scheduledMessageId: scheduledItem.scheduledMessageId,
      service: this.service.name
    })

    if (this.stats) {
      this.stats.increment(msg, this.service, 'scheduled')
    }
  }
}

Scheduler.isPerService = true

module.exports = Scheduler
