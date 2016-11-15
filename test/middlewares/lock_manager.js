var shortid = require('shortid')
var LockManager = require('./../../lib/middlewares/lock_manager')
var Hub = require('./../../lib/hub/hub')

describe('LockManager', function() {
  var service, lockManager
  var hub = new Hub({manifest: {}})

  beforeEach(function*() {
    service = { name: shortid.generate() }
    lockManager = new LockManager({
      service: service,
      hub: hub,
      instanceName: shortid.generate()
    })
    yield lockManager.initialize()
  })

  describe('acquire', function() {
    it('can not acquire lock twice for same resource', function*() {
      var resource = shortid.generate()
      yield lockManager.tryAcquire(resource)
      var result = yield lockManager.tryAcquire(resource)
      expect(result).to.be.equal(null)
    })

    it('it succeeds after lock has been released', function*() {
      var resource = shortid.generate()
      var lock = yield lockManager.tryAcquire(resource)
      yield lockManager.release(lock)
      var result = yield lockManager.tryAcquire(resource)
      expect(result).not.to.equal(null)
    })
  })
})
