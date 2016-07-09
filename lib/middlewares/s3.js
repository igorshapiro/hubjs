"use strict"

var Middleware = require('./middleware')
var AWS = require('aws-sdk')
var S3API = require('aws-promised/s3')

class S3 extends Middleware {
  constructor(options) {
    super(options)

    this.s3 = this.params.s3 || {}
    this.s3.bucketName = (this.s3.bucketName || options.bucketName)
      .replace(":env", this.hub.env)

    this.s3.region = this.s3.region || 'us-east-1'
    AWS.config.region = this.s3.region
  }

  *initialize() {
    this.s3.bucket = S3API({ params: { Bucket: this.s3.bucketName } })
    if (!this.s3.suppressCreateBucket) yield this.s3.bucket.createBucketPromised()
  }
}

module.exports = S3
