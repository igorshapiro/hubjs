"use strict"

var _ = require('lodash')

function getMessageType(msg) { return msg.type || msg.messageType || msg }

// 1 sec, 60 sec, 10 min, 30 min, 1 hour
const defaultSchedule = [1000, 60*1000, 10*60*1000, 30*60*1000, 60*60*1000]

class Service {
  constructor(manifest) {
    this.name = manifest.name

    this.subscribes = []
    this.subscribedBulks = []
    for (var msg of manifest.subscribes || []) {
      var bulkMsgMatch = /^(.*)\@(\d+)$/.exec(msg)
      if (!bulkMsgMatch) {
        this.subscribes.push(msg)
      }
      else {
        var msgType = bulkMsgMatch[1]
        this.subscribes.push(`${msgType}_bulk`)
        this.subscribedBulks.push({
          type: msgType,
          size: parseInt(bulkMsgMatch[2]) || 1000
        })
      }
    }
    this.subscribes = manifest.subscribes || []
    this.publishes = manifest.publishes || []
    this.concurrency = manifest.concurrency || 50
    this.retrySchedule = manifest.retrySchedule || defaultSchedule
    this.maintenance = manifest.maintenance || false

    var requiresEndpoint = this.subscribes.length > 0
    var hasEndpoint = !_.isEmpty(manifest.endpoint)
    if (requiresEndpoint && !hasEndpoint) this.missingError("endpoint")
    this.endpoint = manifest.endpoint
    this.intermediate = manifest.intermediate
    this.queue = manifest.queue
    this.storage = manifest.storage
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

  isSubscriberOfBulk(msg) {
    return this.subscribedBulks.some(_ => _.type === getMessageType(msg))
  }

  buildEndpointUrl(msg) {
    return this.endpoint.replace(':type', msg.type || msg.messageType)
  }
}

module.exports = Service
