"use strict"

var Middleware = require('./middleware')
var URL = require('url')
var _ = require('lodash')

class Transport extends Middleware {
  constructor(options) {
    super(options)

    if (_.isEmpty(options.urlProperty)) throw new Error("Missing `urlProperty`")
    this.rawUrl = this.service[options.urlProperty] || options.defaultUrl
    this.url = URL.parse(this.rawUrl)
    this.host = this.url.host || "localhost"

    if (!options.defaultPort) throw new Error("Missing `defaultPort`")
    this.port = this.url.port || options.defaultPort

    if (_.isEmpty(options.protocol)) throw new Error("Missing `protocol`")
    if (options.protocol && this.url.protocol !== `${options.protocol}:`) {
      throw new Error(
        `${this.rawUrl} doesn't match protocol ${options.protocol}`
      )
    }
  }
}

Transport.isPerService = true

module.exports = Transport
