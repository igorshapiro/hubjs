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

    ev.msg.archivedAt = new Date()
    this.collection.insert(ev.msg, function(err) {
      if (err) log.error({err: err}, "Error logging message in archive")
    })
  }

  *initialize() {
    yield *super.initialize()

    this.collection = this.db.collection(this.collectionName)

    yield this.collection.createIndex(
      { archivedAt: 1 },
      { expireAfterSeconds: this.expireAfterSeconds }
    )

    this.inQueue.on('received', _ => this.logAcceptedMessage(_))
  }
}

Archive.isPerService = true

module.exports = Archive
