"use strict"

var MongoMiddleware = require('./mongo')

class DeadLetter extends MongoMiddleware {
  constructor(options) {
    super(options)

    this.collectionName = `${this.service.name}_dead`
  }

  *initialize() {
    yield* super.initialize()

    this.collection = this.db.collection(this.collectionName)
  }

  *kill(msg) {
    yield this.collection.insertAsync(msg)
  }
}

DeadLetter.isPerService = true

module.exports = DeadLetter
