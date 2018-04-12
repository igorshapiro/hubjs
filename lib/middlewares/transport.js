var Middleware = require('./middleware')
var URL = require('url')
var _ = require('lodash')

class Transport extends Middleware {
  constructor(options) {
    super(options)

    if (_.isEmpty(options.urlProperty)) throw new Error('Missing `urlProperty`')
    var service = this.service || {}
    this.rawUrl = service[options.urlProperty] ||
      this.manifest[options.urlProperty] ||
      options.defaultUrl
    this.url = URL.parse(this.rawUrl)
    this.host = this.url.hostname || 'localhost'
    this.path = this.url.path
    this.auth = this.url.auth ? `${this.url.auth}@` : ''

    if (!options.defaultPort) throw new Error('Missing `defaultPort`')
    this.port = this.url.port || options.defaultPort

    if (_.isEmpty(options.protocol)) throw new Error('Missing `protocol`')
    if (options.protocol && this.url.protocol !== `${options.protocol}:`) {
      throw new Error(
        `${this.rawUrl} doesn't match protocol ${options.protocol}`
      )
    }
  }
}

Transport.isPerService = true

module.exports = Transport
