"use strict"

var URL = require('url')

class Transport {
  constructor(url, defaultPort) {
    var url = URL.parse(url)
    this.url = url
    this.port = url.port || defaultPort
    this.host = url.host || "localhost"
  }

  entityName(entity, service) { return `${service.name}_${entity}` }
  processingEntity(service) { return this.entityName("processing", service) }
  deadEntity(service) { return this.entityName("dead", service) }
  inputEntity(service) { return this.entityName("input", service) }
  outputEntity(service) { return this.entityName("output", service) }
  scheduledEntity(service) { return this.entityName("scheduled", service) }
}

module.exports = Transport
