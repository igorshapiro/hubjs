var Bluebird = require('bluebird')
var MongoDB = Bluebird.promisifyAll(require('mongodb'))
var MongoClient = MongoDB.MongoClient
var _ = require('lodash')
var Transport = require('./transport')

class Mongo extends Transport {
  constructor(options) {
    super(_.merge(options, {
      defaultPort: 27017,
      defaultUrl: 'mongo://localhost/hubjs',
      urlProperty: 'storage',
      protocol: 'mongo'
    }))
    this.dbName = this.path.replace('/', '')
  }

  *initialize() {
    var url = `mongodb://${this.host}:${this.port}/${this.dbName}`
    this.db = yield MongoClient.connectAsync(url)
  }

  *getCount() {
    if (!this.collection) return 0

    var stats = yield this.collection.statsAsync()
    return stats.count
  }

  *stop() {
    yield this.db.closeAsync()
  }
}

module.exports = Mongo
