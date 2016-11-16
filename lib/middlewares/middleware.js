const EventEmitter = require('events')
const TEN_SECONDS = 10 * 1000
var co = require('co')

class Middleware extends EventEmitter {
  constructor(options) {
    super()

    this.typeName = options.typeName || this.constructor.name
    if (!options.instanceName) {
      throw new Error(`No 'instanceName' provided for middleware ${this.typeName}`)
    }
    this.instanceName = options.instanceName

    this.hub = options.hub
    this.manifest = this.hub.manifest
    this.log = this.hub.log

    this.service = options.service
    this.params = options.params || {}
    this.needs = {}
    this.supports = {}
    this.pollingIntervalMillis = options.pollingIntervalMillis || TEN_SECONDS
  }

  defineDependency(array, name, injectAs, service) {
    if (injectAs.includes(':service')) {
      this.hub.services.forEach((svc) => {
        array[this.buildInstanceName(name, svc)] = injectAs.replace(':service', svc.name)
      })
    } else if (service) {
      array[this.buildInstanceName(name, service)] = injectAs
    } else {
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
    if (name.includes(':service')) {
      name = name.replace(':service', (service || this.service).name)
    }
    return this[name]
  }

  buildInstanceName(name, service) {
    return this.hub.buildInstanceName(name, service)
  }

  *initialize() { }
  *purge() { }
  *terminate() {
    this.stopped = true
    if (this.intervalId) clearInterval(this.intervalId)
  }
  *stop() { this.terminate() }
  *start() {
    if (this.intervalHandler) {
      var boundHandler = this.intervalHandler.bind(this)
      this.intervalId = setInterval(function() {
        if (this.stopped) return
        co(boundHandler).catch(_ => log.error(_))
      }, this.pollingIntervalMillis)
    }
  }
}

Middleware.isPerService = false

module.exports = Middleware
