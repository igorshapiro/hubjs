"use strict"

var S = require('string')
var _ = require('lodash')
var Service = require('./service')

class Hub {
  constructor(options) {
    this.options = options
    this.manifest = options.manifest
    this.config = options.config || require('./../../config/config')
    this.middlewares = []
    this.registry = {}
  }

  createService(manifest, name) {
    manifest.name = name
    return new Service(manifest)
  }

  buildInstanceName(name, service) {
    if (service) return `${name}/${service.name}`
    return name
  }

  get(name, service) {
    return this.registry[this.buildInstanceName(name, service)]
  }

  register(name, middleware) {
    this.middlewares.push(middleware)
    this.registry[name] = middleware
  }

  createMiddlewares() {
    for (let cfg of this.config.middlewares) {
      let params = cfg.params || {}
      let Middleware = cfg.type
      let typeName = S(Middleware.name).underscore().s
      let instanceName = typeName
      let options = {
        typeName: typeName,
        // should be suffixed by service for per-service middlewares
        instanceName: instanceName,
        hub: this,
        params: params
      }
      if (Middleware.isPerService) {
        this.services.forEach((svc) => {
          instanceName = this.buildInstanceName(typeName, svc)
          options.instanceName = instanceName
          options.service = svc
          let middleware = new Middleware(options)
          this.register(instanceName, middleware)
        })
      }
      else {
        let middleware = new Middleware(options)
        this.register(instanceName, middleware)
      }
    }
  }

  *initDependencies(mw, dependencies, visited, mandatory) {
    for (let name in dependencies) {
      var dependency = this.get(name)
      if (!dependency && mandatory) throw new Error(`Unable to resolve dependency ${name}`)
      yield this.initializeMiddleware(dependency, visited)
      mw[dependencies[name]] = dependency
    }
  }

  *initializeMiddleware(mw, visited) {
    if (!mw) return
    if (visited.has(mw)) return

    log.trace({instanceName: mw.instanceName}, "Initializing middleware")

    visited.add(mw)

    yield this.initDependencies(mw, mw.needs || {}, visited, true)
    yield this.initDependencies(mw, mw.supports || {}, visited, false)

    yield mw.initialize()
  }

  // Initializes the middlewares according to their dependencies list
  *initializeMiddlewares() {
    var visited = new Set()
    for (var mw of this.middlewares) {
      yield this.initializeMiddleware(mw, visited)
    }
  }

  *loadManifest() {
    return require('./../../services.json')
  }

  *run() {
    if (!this.manifest) {
      this.manifest = yield this.loadManifest()
    }
    this.services = _.map(this.manifest.services, this.createService)
    this.createMiddlewares()

    yield this.initializeMiddlewares()
    yield this.middlewares.map(_ => _.start())
  }

  *purge() {
    yield this.middlewares.map(_ => {
      log.trace(`Purging ${_.instanceName}`)
      return _.purge()
    })
  }

  *stop() {
    yield this.middlewares.map(_ => {
      log.trace(`Stopping ${_.instanceName}`)
      return _.stop()
    })
    this.middlewares = []
    this.registry = {}
  }

  getService(name) {
    return this.services.find(_ => _.name === name)
  }

  getPublisherOf(msg) {
    return this.services.find(_ => _.isPublisherOf(msg))
  }

  getSubscribersOf(msg) {
    return this.services.filter(_ => _.isSubscriberOf(msg))
  }
}

module.exports = Hub
