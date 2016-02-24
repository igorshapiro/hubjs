"use strict"

var MongoMiddleware = require('./mongo')

class DeadLetter extends MongoMiddleware {
  constructor(options) {
    super(options)

    this.defineOptionalDependency('stats_reporter', 'stats')

    this.collectionName = `${this.service.name}_dead`
  }

  *initialize() {
    yield* super.initialize()

    this.collection = this.db.collection(this.collectionName)
  }

  *kill(msg) {
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
