"use strict"

var S3 = require('./s3')
var shortid = require('shortid')
var _ = require('lodash')
var co = require('co')
var PassThrough = require('stream').PassThrough
var Bluebird = require('bluebird')
var level = Bluebird.promisifyAll(require('levelup'))
var split2 = require('split2')
var fs = Bluebird.promisifyAll(require('fs'))

const MAX_REPLAY_FILES = 100000

class S3Stream extends S3 {
  constructor(options) {
    super(options)

    this.secondsInChunk = this.params.secondsInChunk || 60
    this.s3.objects = {}      // Repository for S3 objects and their streams
    this.sourceId = shortid.generate()

    this.writeAsync = co.wrap(this.write.bind(this))
  }

  // Closes the stream and deletes the corresponding S3 object from the repository
  closeStream(key) {
    var objects = this.s3.objects
    if (!objects[key]) return
    objects[key].then(_ => _.stream.end()).catch(_ => log.error(_))
    delete objects[key]
  }

  // Creates an S3 object specified by `obj` and initializes `obj.stream`
  *createObject(obj) {
    obj.stream = new PassThrough()
    this.s3.bucket.uploadPromised({
      Body: obj.stream,
      Key: obj.key,
      Bucket: this.s3.bucketName
    })
    return obj
  }

  *getOrCreateObject() {
    var now = Date.now()
    var millisInChunk = this.secondsInChunk * 1000
    var graceMillis = 1000
    var start = Math.floor(now / millisInChunk) * millisInChunk
    var end = start + millisInChunk - 1
    var key = `${start.toString()}-${end.toString()}_${this.sourceId}`
    if (!this.s3.objects[key]) {
      var obj = { key: key, start: start, end: end }
      // This initializes the `objects[key]` to a promise.
      // Any concurrent requests to `getStream()` will use this promise
      this.s3.objects[key] = co(this.createObject.bind(this), obj)
      setTimeout(this.closeStream.bind(this), millisInChunk + graceMillis, key)
    }
    return this.s3.objects[key]
  }

  *write(obj) {
    var buffer = new Buffer(JSON.stringify(obj) + "\n")
    var object = yield this.getOrCreateObject()
    object.stream.push(buffer)
  }

  checkObjectConstraints(key, constraints) {
    var match = /(\d+)-(\d+)/.exec(key)
    var keyFrom = parseInt(match[1]), keyTo = parseInt(match[2])
    if (constraints.toTimestamp && keyTo > parseInt(constraints.toTimestamp)) {
      return false
    }
    if (constraints.fromTimestamp && keyFrom < parseInt(constraints.fromTimestamp)) {
      return false
    }
    return true
  }


  *assertTempDir() {
    try{
      yield fs.mkdirAsync('./tmp')
    }
    catch (e) {
      if (e.code !== 'EEXIST') log.error(e, "Error creating ./tmp")
    }
  }

  // Returns a stream of events (ordered)
  // options:
  //   fromTimestamp - return only events after `fromTimestamp`
  //   toTimestamp - return only events before `toTimestamp`
  //   deliverTo - array of service names to deliver the message to
  *read(options) {
    var objectsList = yield this.s3.bucket.listObjectsPromised({
      Bucket: this.s3.bucketName,
      MaxKeys: MAX_REPLAY_FILES
    })
    var dbName = shortid.generate()
    yield this.assertTempDir()
    this.levelDB = level(`./tmp/${dbName}`)
    yield objectsList.Contents
      .map(_ => _.Key)
      .filter(_ => this.checkObjectConstraints(_, options))
      .map(this.storeS3EventsInLocalDB.bind(this))
    var query = {}
    if (options.fromTimestamp) query.gte = options.fromTimestamp.toString()
    if (options.toTimestamp) query.lt = (parseInt(options.toTimestamp) + 1).toString()
    return this.levelDB.createValueStream(query)
  }

  storeS3EventsInLocalDB(s3KeyName) {
    var total = 0, written = 0, endReached = false
    return new Promise((resolve, reject) => {
      var stream = this.s3.bucket
        .getObject({
          Bucket: this.s3.bucketName,
          Key: s3KeyName
        })
        .createReadStream()
        .pipe(split2(JSON.parse))     // Split by \n and parse the documents
        .on('data', obj => {
          var key = `${obj.timestamp}-${obj.messageId}`
          total++
          this.levelDB.put(key, JSON.stringify(obj), function(err) {
            if (err) return log.error({msg: obj, err: err}, "Failed storing message in LevelDB")
            written++
            if (endReached && written == total) {
              log.info({written: written}, "All messages stored in LevelDB")
              resolve()
            }
          })
        })
        .on('end', () => endReached = true)
    })
  }
}

module.exports = S3Stream
