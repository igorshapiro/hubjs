var Redis = require('./redis')
var Redlock = require('redlock')
var shortid = require('shortid')

class LockManager extends Redis {
  *initialize() {
    yield* super.initialize()

    this.redlock = new Redlock([this.client], {
      driftFactor: 0.05, retryCount: 1, retryDelay: 200
    })

    // Perform self test...
    var testLock = yield this.tryAcquire(shortid.generate())
    if (!testLock) throw new Error('Lock manager: Unable to acquire test lock during self-test')
    yield this.release(testLock)
  }

  *tryAcquire(name) {
    try {
      return yield this.redlock.lock(name, 60 * 1000)
    } catch (ex) {
      // log.error(ex, `Unable to acquire lock ${name}`)
      return null
    }
  }

  *release(lock) {
    yield lock.unlock()
  }
}

module.exports = LockManager
