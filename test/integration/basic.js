var Scenario = require('./scenario')

describe('ServiceHub', function() {
  var hubScenario
  beforeEach(function*() {
    hubScenario = Scenario()
  })
  afterEach(function*() {
    yield hubScenario.reset()
  })

  it('Delivers message to service', function*() {
    yield hubScenario.forHub()
      .withSubscriber('deliveryTestMsg').at('/handlers/:type')
      .whenSendingMessage({type: 'deliveryTestMsg'})
      .itIsReceivedAt('/handlers/deliveryTestMsg')
      .run()
  })

  it('Retries message delivery on failure', function*() {
    yield hubScenario.forHub()
      .withSubscriber('scheduleTestMsg', {
        status: 500, retrySchedule: [100, 200, 300]
      }).at('/handlers/:type')
      .whenSendingMessage({type: 'scheduleTestMsg'})
      .itIsReceivedAt('/handlers/scheduleTestMsg', {times: 5})
      .withinSchedule(0, 100, 300, 600, 900)
      .run()
  })

  it('Reschedule message', function*() {
    yield hubScenario.forHub()
      .withSubscriber('rescheduleTestMsg', {
        headers: { 'Retry-After': 1 }, status: 302
      }).at('/handlers/:type')
      .whenSendingMessage({type: 'rescheduleTestMsg'})
      .itIsReceivedAt('/handlers/rescheduleTestMsg', { times: 2 })
      .withinSchedule(0, 1000)
      .run()
  })

  describe('Recurring messages', function() {
    it('Schedules message every specified time', function*() {
      yield hubScenario.forHub()
        .withSubscriber('recurringMsg', { status: 200 }).at('/handlers/:type')
        .whenRegisteringRecurringMessage({
          type: 'recurringMsg',
          deliverEveryMillis: 100
        })
        .itIsReceivedAt('/handlers/recurringMsg', {times: 4})
        .withinSchedule(0, 100, 200, 300)
        .after(400)
        .run()
    })
  })

  describe('Concurrent messages', function() {
    it('Sends up-to concurrency messages', function*() {
      yield hubScenario.forHub()
        .withSubscriber('concurrencyTestMsg')
          .withConcurrency(5)
          .withResponseTaking(1000)
          .at('/handlers/:type')
        .whenSendingMessage({type: 'concurrencyTestMsg'}, {times: 100})
        .itIsReceivedAt('/handlers/concurrencyTestMsg', {times: 5})
        .after(100)
        .run()
    })

    it('Sends up-to concurrency, even from multiple hub processes', function*() {
      yield hubScenario.forHub({ instances: 2 })
        .withSubscriber('distributedConcurrencyTestMsg')
          .withConcurrency(6)
          .withResponseTaking(1500)
          .at('/handlers/:type')
        .whenSendingMessage({ type: 'distributedConcurrencyTestMsg' }, { times: 100 })
        .itIsReceivedAt('/handlers/distributedConcurrencyTestMsg', { times: 6 })
        .after(500)
        .run()
    })
  })
})
