"use strict"

var Middleware = require('./middleware')
var co = require('co')

class Monitor extends Middleware {
  constructor(options) {
    super(options)

    this.defineOptionalDependency('in_queue', 'inQueue', this.service)
    this.defineOptionalDependency('out_queue', 'outQueue', this.service)
    this.defineOptionalDependency('dead_letter', 'deadLetter', this.service)
    this.defineOptionalDependency('scheduler', 'scheduler', this.service)
    this.defineOptionalDependency('stats_reporter', 'stats')

    this.intervalMillis = this.params.intervalMillis || 5000
  }

  *reportMonitorStats() {
    var prefix = `hub.services.${this.service.name}`
    this.stats.gauge(`${prefix}.in_count`, yield this.inQueue.getCount())
    this.stats.gauge(`${prefix}.out_count`, yield this.outQueue.getCount())
    this.stats.gauge(`${prefix}.dead_count`, yield this.deadLetter.getCount())
    this.stats.gauge(`${prefix}.schedule_count`, yield this.scheduler.getCount())
  }

  *start() {
    yield *super.start()

    var me = this
    this.intervalId = setInterval(function() {
      co(me.reportMonitorStats.bind(me))
        .catch(_ => log.error(_))
    }, this.intervalMillis)
  }

  *stop() {
    yield *super.stop()

    clearInterval(this.intervalId)
  }
}

Monitor.isPerService = true

module.exports = Monitor
