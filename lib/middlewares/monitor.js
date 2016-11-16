var Middleware = require('./middleware')

class Monitor extends Middleware {
  constructor(options) {
    super(options)

    this.defineOptionalDependency('in_queue', 'inQueue', this.service)
    this.defineOptionalDependency('out_queue', 'outQueue', this.service)
    this.defineOptionalDependency('dead_letter', 'deadLetter', this.service)
    this.defineOptionalDependency('scheduler', 'scheduler', this.service)
    this.defineOptionalDependency('stats_reporter', 'stats')

    this.pollingIntervalMillis = this.params.intervalMillis || 5000
  }

  *intervalHandler() { yield this.reportMonitorStats() }

  *reportMonitorStats() {
    var prefix = `hub.services.${this.service.name}`
    this.stats.gauge(`${prefix}.in_count`, yield this.inQueue.getCount())
    this.stats.gauge(`${prefix}.out_count`, yield this.outQueue.getCount())
    this.stats.gauge(`${prefix}.dead_count`, yield this.deadLetter.getCount())
    this.stats.gauge(`${prefix}.schedule_count`, yield this.scheduler.getCount())
  }
}

Monitor.isPerService = true

module.exports = Monitor
