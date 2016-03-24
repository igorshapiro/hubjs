"use strict"

var S3Stream = require('./s3stream')
var co = require('co')
var _ = require('lodash')

class Archive extends S3Stream {
  constructor(options) {
    super(_.merge(options, {
      bucketName: 'hub_archive_:env'
    }))

    this.defineMandatoryDependency('api', 'api')
  }

  // archivedAt - used only for tests
  logAcceptedMessage(ev, archivedAt) {
    var msg = ev.msg
    msg.archivedAt = archivedAt || new Date()
    this.writeAsync(msg).catch(_ => log.error(_))
  }

  *replay(fromTimestamp) {
    var stream = this.collection.find({archivedAt: {$gte: fromTimestamp}}).stream()

    var q = this.inQueue
    stream.on('data', (msg) => co(q.enqueue, msg))
    return new Promise(function(resolve, reject) {
      stream.on('end', resolve)
    })
  }

  *initialize() {
    yield *super.initialize()

    this.api.on('accepted', _ => this.logAcceptedMessage(_))
  }
}

Archive.isPerService = false

module.exports = Archive
