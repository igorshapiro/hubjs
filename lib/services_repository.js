var _ = require('lodash')
var fs = require('fs')
var Service = require('./service')
var path = require('path')

module.exports = function(manifest, options) {
  var _this = this;
  this.options = options || {}
  this.manifest = _.isObject(manifest) ? manifest : null
  this.manifestLocation = _.isEmpty(manifest) ? "./services.json" : manifest
  this.services = []

  function *loadFromFile(manifestLocation) {
    return JSON.parse(fs.readFileSync(manifestLocation, 'utf8'))
  }

  function *loadManifest() {
    if (_this.manifest != null) return

    var location = _this.manifestLocation
    var manifest

    log.info("No manifest provieded. Loading from: " + location)
    if (location.indexOf("./") == 0 || location.indexOf("/") == 0) {
      var manifestPath = path.join(process.cwd(), location)
      log.debug("Manifest location resolved to: " + manifestPath)
      manifest = yield loadFromFile(manifestPath)
    }
    else //if (location.startsWith("http://"))
      throw new Error("TBD")

    log.info({manifest: manifest})

    _this.manifest = manifest
  }

  function validateManifest() {
    var services = _this.manifest.services
    if (!services) throw new Error("Invalid manifest: ")
    if (Object.keys(services).length == 0) throw new Error("No services defined")
  }

  function *loadServices() {
    var svcManifests = _this.manifest.services
    for (var name in svcManifests) {
      var svcManifest = svcManifests[name]
      svcManifest.name = name
      var svc = new Service(_this, svcManifest)
      _this.services.push(svc)
      yield svc.run()
    }
  }

  this.getPublisherOf = function(msg) {
    return _.find(this.services, (svc) => svc.isPublisherOf(msg.messageType))
  }

  this.getSubscribersOf = function(msg) {
    return _.filter(this.services, (svc) => svc.isSubscriberOf(msg.messageType))
  }

  this.getService = function(name) {
    return _.find(this.services, (svc) => svc.name == name)
  }

  this.initialize = function*() {
    yield loadManifest()
    validateManifest()
    yield loadServices()
  }
}
