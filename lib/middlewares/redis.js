"use strict"

var Transport = require('./transport')
var _ = require('lodash')
var bluebird = require('bluebird')

var redis = require('redis');
bluebird.promisifyAll(redis.RedisClient.prototype);
bluebird.promisifyAll(redis.Multi.prototype);

class Redis extends Transport {
  constructor(options) {
    super(_.merge(options, {
      defaultPort: 6379,
      defaultUrl: 'redis://localhost',
      urlProperty: 'intermediate',
      protocol: 'redis'
    }))
  }

  *initialize() {
    var auth = this.url.auth ? (this.url.auth + "@") : ""
    var url = `redis://${auth}${this.host}:${this.port}`
    this.client = redis.createClient({url: url})

    this.client.on('error', _ => log.error(_))
  }
}

module.exports = Redis
