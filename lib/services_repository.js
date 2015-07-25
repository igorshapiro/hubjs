var _ = require('lodash')
var fs = require('fs')
var Service = require('./service')

module.exports = function(manifest) {
  var _this = this;
  this.manifest = _.isObject(manifest) ? manifest : null
  this.manifestLocation = _.isEmpty(manifest) ? "./services.json" : manifest
  this.services = []

  function *loadFromFile(manifestLocation) {
    JSON.parse(fs.readFileSync(manifestLocation, 'utf8'))
  }

  function *loadManifest() {
    if (_this.manifest != null) return

    var location = _this.manifestLocation
    var manifest

    if (location.startsWith("./" || location.startsWith("/")))
      manifest = loadFromFile(manifest)
    else if (location.startsWith("http://"))
      throw new Error("TBD")

    _this.manifet = manifest
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
    return _.find(this.services, function(svc) {
      return svc.isPublisherOf(msg.type)
    })
  }

  this.getSubscribersOf = function(msg) {
    return _.filter(this.services, function(svc) {
      return svc.isSubscriberOf(msg.type)
    })
  }

  this.initialize = function*() {
    yield loadManifest()
    validateManifest()
    yield loadServices()
  }
}