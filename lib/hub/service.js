"use strict"

var S = require('string')

function getMessageType(msg) { return msg.type || msg }

class Service {
  constructor(manifest) {
    this.name = manifest.name

    this.subscribes = manifest.subscribes || []
    this.publishes = manifest.publishes || []
    this.concurrency = manifest.concurrency || 50

    var requiresEndpoint = this.subscribes.length > 0
    var hasEndpoint = !S(manifest.endpoint).isEmpty()
    if (requiresEndpoint && !hasEndpoint) this.missingError("endpoint")
    this.endpoint = manifest.endpoint
  }

  missingError(attribute) {
    throw new Error(`Service manifest is missing '${attribute}' (${this.name})`)
  }

  isPublisherOf(msg) {
    return this.publishes.some(_ => _ === getMessageType(msg))
  }

  isSubscriberOf(msg) {
    return this.subscribes.some(_ => _ === getMessageType(msg))
  }
}

module.exports = Service
