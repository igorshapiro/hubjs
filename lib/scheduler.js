var Promise = require('bluebird')
var co = require('co')

module.exports = function(service, options) {
  var pollingInterval = options.schedulePollingInterval || 5000
  var stopped = false

  this.getDueMessages = function*() {
    return yield service.storageTransport.getDueMessages(service, Date.now())
  }

  this.start = function*() {
    stopped = false
    this.poll()
  }

  var _this = this
  this.poll = function() {
    co(function*() {
      var dueMessages = yield _this.getDueMessages()
      for (var scheduledMsg of dueMessages) {
        yield service.enqueueInput(scheduledMsg.message)
        yield service.storageTransport.removeScheduledMessage(service, scheduledMsg)
      }
    })
      .then(function() {
        if (stopped) return
        setTimeout(_this.poll, pollingInterval)
      })
      .catch(function(ex) {
        log.error({ err: ex }, "Polling halted")
      })
  }

  this.stop = function*() {
    stopped = true
  }
}
