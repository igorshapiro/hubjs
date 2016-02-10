"use strict"

var Middleware = require('./middleware')

class ErrorHandler extends Middleware {
  constructor(options) {
    super(options)

    this.defineMandatoryDependency('scheduler', 'scheduler', this.service)
    this.defineMandatoryDependency('dead_letter', 'deadLetter', this.service)
    this.schedule = this.service.retrySchedule
  }

  *handle(response, service, msg) {
    if (!msg.maxAttempts) msg.maxAttempts = 5
    msg.attemptsMade = msg.attemptsMade ? msg.attemptsMade + 1 : 1
    log.debug({
      maxAttempts: msg.maxAttempts,
      attemptsMade: msg.attemptsMade,
      msgId: msg.messageId, msg: msg
    }, "Message failed")
    if (msg.attemptsMade >= msg.maxAttempts) {
      yield this.deadLetter.kill(msg)
    }
    else {
      var dueTime = Date.now() + this.getDelay(msg)
      yield this.scheduler.schedule(msg, dueTime)
    }
  }

  getDelay(msg) {
    const defaultDelaySec = 5

    if (!this.schedule) return defaultDelaySec * 1000

    return this.schedule[msg.attemptsMade - 1]
      || this.schedule[this.schedule.length - 1]
      || defaultDelaySec * 1000
  }
}

ErrorHandler.isPerService = true

module.exports = ErrorHandler
