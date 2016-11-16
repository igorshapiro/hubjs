var Mongo = require('./mongo')
var co = require('co')

class Archive extends Mongo {
  constructor(options) {
    super(options)

    this.defineMandatoryDependency('in_queue', 'inQueue', this.service)
    this.collectionName = `${this.service.name}_archive`
    this.expireAfterSeconds = this.service.expireAfterSeconds || 24 * 3600
  }

  // archivedAt - used only for tests
  logAcceptedMessage(ev, archivedAt) {
    var msg = ev.msg

    if (msg.attemptsMade ||      // ignore retries
      msg.recurringMessageId ||  // ignore recurring messages
      msg.archivedAt             // ignore archied messages (that were replayed)
    ) return

    msg.archivedAt = archivedAt || new Date()

    return this.collection.insertAsync(msg)
      .catch(_ => log.error({err: _}, 'Error logging message in archive'))
  }

  *replay(fromTimestamp) {
    var stream = this.collection.find({archivedAt: {$gte: fromTimestamp}}).stream()

    var q = this.inQueue
    stream.on('data', (msg) => co(q.enqueue, msg))
    return new Promise(function(resolve, reject) {
      stream.on('end', resolve)
    })
  }

  *createIndexes() {
    yield this.collection.createIndex(
      { archivedAt: 1 },
      { expireAfterSeconds: this.expireAfterSeconds }
    )
  }

  *initialize() {
    yield* super.initialize()

    this.collection = this.db.collection(this.collectionName)

    yield this.createIndexes()

    this.inQueue.on('received', _ => this.logAcceptedMessage(_))
  }

  *getMessages(page, pageSize) {
    pageSize = pageSize || 50
    page = page || 1
    var offset = (page - 1) * pageSize
    var messages = yield this.collection.find({}).skip(offset).limit(pageSize).toArrayAsync()
    var stats = yield this.collection.statsAsync()
    messages.total = stats.count
    return messages
  }
}

Archive.isPerService = true

module.exports = Archive
