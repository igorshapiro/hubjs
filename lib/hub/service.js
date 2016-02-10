"use strict"

var _ = require('lodash')

function getMessageType(msg) { return msg.type || msg }

// 1 sec, 60 sec, 10 min, 30 min, 1 hour
const defaultSchedule = [1000, 60*1000, 10*60*1000, 30*60*1000, 60*60*1000]

class Service {
  constructor(manifest) {
    this.name = manifest.name

    this.subscribes = manifest.subscribes || []
    this.publishes = manifest.publishes || []
    this.concurrency = manifest.concurrency || 50
    this.retrySchedule = manifest.retrySchedule || defaultSchedule

    var requiresEndpoint = this.subscribes.length > 0
    var hasEndpoint = !_.isEmpty(manifest.endpoint)
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

  buildEndpointUrl(msg) {
    return this.endpoint.replace(':type', msg.type)
  }
}

module.exports = Service
