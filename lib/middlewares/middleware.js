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

  defineDependency(array, name, injectAs, service) {
    if (injectAs.indexOf(':service') != -1) {
      this.hub.services.forEach((svc) => {
        array[this.buildInstanceName(name, svc)] = injectAs.replace(':service', svc.name)
      })
    }
    else if (service) {
      array[this.buildInstanceName(name, service)] = injectAs
    }
    else {
      array[name] = injectAs
    }
  }

  defineMandatoryDependency(name, injectAs, service) {
    this.defineDependency(this.needs, name, injectAs, service)
  }

  defineOptionalDependency(name, injectAs, service) {
    this.defineDependency(this.supports, name, injectAs, service)
  }

  getDependency(name, service) {
    if (name.indexOf(':service') !== -1) {
      name = name.replace(':service', (service || this.service).name)
    }
    return this[name]
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
