"use strict"

var Bluebird = require('bluebird')
var Scenario = require('./scenario')

describe ("Inspector", function() {
  var hubScenario
  beforeEach(function() {
    hubScenario = Scenario()
  })
  afterEach(function*() {
    yield hubScenario.reset()
  })

  it ("Records all events", function*() {
    yield hubScenario.forHub()
      .withSubscriber('scheduleTestMsg', {
        status: 500, retrySchedule: [100]
      }).at('/handlers/:type')
      .whenSendingMessage({type: 'scheduleTestMsg', maxAttempts: 3})
      .itIsReceivedAt('/handlers/scheduleTestMsg', {times: 5})
      .withPredicate(function(scenario) {
        return { passed: true, error: "Something failed" }
      })
      .after(500)
      .run()
  })
})
