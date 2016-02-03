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
  }

  *initialize() { }
  *purge() { }
  *terminate() { }
  *stop() { this.terminate() }
  *start() { }
}

Middleware.isPerService = false

module.exports = Middleware
