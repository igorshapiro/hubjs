"use strict"

class Middleware {
  constructor(options) {
    this.typeName = options.typeName || this.constructor.name
    if (!options.instanceName) {
      throw new Error(`No 'instanceName' provided for middleware ${this.typeName}`)
    }
    this.instanceName = options.instanceName

    this.hub = options.hub
    this.manifest = this.hub.manifest
    this.log = this.hub.log

    this.service = options.service
    this.params = options.params
    this.needs = {}
    this.supports = {}
  }

  buildInstanceName(name, service) {
    return this.hub.buildInstanceName(name, service)
  }

  *initialize() { }
  *purge() { }
  *terminate() { }
  *stop() { this.terminate() }
  *start() { }
}

Middleware.isPerService = false

module.exports = Middleware