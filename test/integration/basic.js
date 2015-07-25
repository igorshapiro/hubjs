describe('ServiceHub', function() {
  var svcHost = "http://localhost:3100"

  var hub = null
  before(function*() {
    hub = new Hub({manifest: {services: {
      pub: {
        publishes: ['will_succeed', 'will_fail']
      },
      sub: {
        subscribes: ['will_succeed', 'will_fail']
      }
    }}})
    yield hub.start()
  })

  it ("Delivers message to service", function*() {
    var req = nock(svcHost)
      .post('/will_succeed')
      .reply(200, 'Ok')

    yield hubClient.sendMessage({type: 'will_succeed'})
    yield hubHelpers.expectWithin(1000, req.isDone)
  })

  it ("Re-delivers message to service if 2xx or 3xx not returned", function*() {
    var req = nock(svcHost)
      .post('/will_fail')
      .times(5)
      .reply(500, 'Failure')

    yield hubClient.sendMessage({type: 'will_fail'})
    yield hubHelpers.expectWithin(200, function() { req.pendingMocks == 0 })
  })
})
