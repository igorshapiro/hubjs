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
    this.defineMandatoryDependency('in_queue', ':service_in')
  }

  // archivedAt - used only for tests
  logAcceptedMessage(ev, archivedAt) {
    var msg = ev.msg
    msg.archivedAt = archivedAt || new Date()
    this.writeAsync(msg).catch(_ => log.error(_))
  }

  *replay(options) {
    var stream = yield this.read(options)

    if (!options.service) throw new Error(`Unknown service: ${options.service}`)
    var svc = this.hub.getService(options.service)

    var q = this.getDependency(':service_in', svc)
    stream.on('data', (msg) => co(q.enqueue.bind(q), JSON.parse(msg)))
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
