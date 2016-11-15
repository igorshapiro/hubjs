var Middleware = require('./middleware')

const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE

class ErrorHandler extends Middleware {
  constructor(options) {
    super(options)

    this.defineMandatoryDependency('scheduler', 'scheduler', this.service)
    this.defineMandatoryDependency('dead_letter', 'deadLetter', this.service)
    this.defineOptionalDependency('stats_reporter', 'stats')
    this.schedule = this.service.retrySchedule || [
      5 * SECOND, 3 * MINUTE, 30 * MINUTE, 6 * HOUR
    ]
  }

  *handle(response, service, msg) {
    if (!msg.maxAttempts) msg.maxAttempts = 5
    msg.attemptsMade = msg.attemptsMade ? msg.attemptsMade + 1 : 1
    log.debug({
      maxAttempts: msg.maxAttempts,
      attemptsMade: msg.attemptsMade,
      msgId: msg.messageId,
      msg: msg
    }, 'Message failed')
    this.setLastError(msg, response)
    if (msg.attemptsMade >= msg.maxAttempts) {
      yield this.deadLetter.kill(msg)
    } else {
      // For backward compatibility
      if (!msg.attemptDelays) msg.attemptDelays = this.schedule

      var dueTime = Date.now() + this.getDelay(msg)
      yield this.scheduler.schedule(msg, dueTime)

      if (this.stats) this.stats.increment(msg, service, 'scheduled')
    }
  }

  setLastError(msg, response) {
    if (response.statusCode) {
      return msg.lastError = {
        statusCode: response.statusCode,
        body: response.body
      }
    }
    if (response.stack) {
      return msg.lastError = {
        message: response.message,
        stack: response.stack
      }
    }
  }

  getDelay(msg) {
    const defaultDelaySec = 5

    var schedule = msg.attemptDelays || this.schedule
    if (!schedule) return defaultDelaySec * 1000

    return schedule[msg.attemptsMade - 1] ||
      schedule[schedule.length - 1] ||
      defaultDelaySec * 1000
  }
}

ErrorHandler.isPerService = true

module.exports = ErrorHandler
