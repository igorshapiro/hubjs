"use strict"

var Mongo = require('./mongo')

class Archive extends Mongo {
  constructor(options) {
    super(options)

    this.defineMandatoryDependency('in_queue', 'inQueue', this.service)
    this.collectionName = `${this.service.name}_archive`
    this.expireAfterSeconds = this.service.expireAfterSeconds || 24 * 3600
  }

  logAcceptedMessage(ev) {
    var msg = ev.msg

    if (msg.attemptsMade            // ignore retries
      || msg.recurringMessageId     // ignore recurring messages
    ) return

    msg.archivedAt = new Date()
    this.collection.insert(msg, function(err) {
      if (err) log.error({err: err}, "Error logging message in archive")
    })
  }

  *createIndexes() {
    yield this.collection.createIndex(
      { archivedAt: 1 },
      { expireAfterSeconds: this.expireAfterSeconds }
    )
  }

  *initialize() {
    yield *super.initialize()

    this.collection = this.db.collection(this.collectionName)

    yield this.createIndexes()

    this.inQueue.on('received', _ => this.logAcceptedMessage(_))
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

Archive.isPerService = true

module.exports = Archive
