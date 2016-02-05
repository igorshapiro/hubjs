"use strict"

var S = require('string')
var _ = require('lodash')
var Service = require('./service')

class Hub {
  constructor(options) {
    this.options = options
    this.manifest = options.manifest
    this.services = _.map(this.manifest, this.createService)
    this.config = options.config || require('./../../config/config')
    this.middlewares = []
    this.registry = {}
  }

  createService(manifest, name) {
    manifest.name = name
    return new Service(manifest)
  }

  get(name) {
    return this.registry[name]
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
      let middleware = new Middleware(options)
      this.register(instanceName, middleware)
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
    if (visited.has(mw)) return

    yield this.initDependencies(mw, mw.needs || {}, visited, true)

    yield mw.initialize()
    visited.add(mw)
  }

  // Initializes the middlewares according to their dependencies list
  *initializeMiddlewares() {
    var visited = new Set()
    yield this.middlewares.map(_ => this.initializeMiddleware(_, visited))
  }

  *run() {
    this.createMiddlewares()

    yield this.initializeMiddlewares()
    yield this.middlewares.map(_ => _.start())
  }

  *purge() {
    yield this.middlewares.map(_ => _.purge())
  }

  *stop() {
    yield this.middlewares.map(_ => _.stop())
  }
}

module.exports = Hub
