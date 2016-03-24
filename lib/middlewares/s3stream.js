"use strict"

var S3 = require('./s3')
var shortid = require('shortid')
var _ = require('lodash')
var co = require('co')
var PassThrough = require('stream').PassThrough

class S3Stream extends S3 {
  constructor(options) {
    super(options)

    this.secondsInChunk = this.params.secondsInChunk || 60
    this.pollingIntervalMillis = 1000
    this.s3.objects = {}      // Repository for S3 objects and their streams
    this.sourceId = shortid.generate()

    this.writeAsync = co.wrap(this.write.bind(this))
  }

  // Closes the stream and deletes the corresponding S3 object from the repository
  closeStream(key) {
    var objects = this.s3.objects
    console.log(key, objects[key])
    if (!objects[key]) return
    objects[key].then(_ => _.stream.end()).catch(_ => log.error(_))
    delete objects[key]
  }

  // Creates an S3 object specified by `obj` and initializes `obj.stream`
  *createObject(obj) {
    var stream = new PassThrough()
    obj.stream = stream
    this.s3.bucket.uploadPromised({
      Body: stream,
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
    var key = `${start.toString()}-${this.sourceId}`
    if (!this.s3.objects[key]) {
      var obj = { key: key, start: start, end: start + millisInChunk - 1 }
      // This initializes the `objects[key]` to a promise.
      // Any concurrent requests to `getStream()` will use this promise
      this.s3.objects[key] = co(this.createObject.bind(this), obj)
      setTimeout(this.closeStream.bind(this), millisInChunk + graceMillis, key)
    }
    return this.s3.objects[key]
  }

  *write(obj) {
    var buffer = new Buffer(JSON.stringify(obj))
    var object = yield this.getOrCreateObject()
    object.stream.push(buffer)
  }
}

module.exports = S3Stream
