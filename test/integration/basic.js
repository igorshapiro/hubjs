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

  function mockEndpoint(path, status, msg, times) {
    var req = nock(svcHost).post(path)
    if (times)
      req = req.times(times)
    return req.reply(status, msg || "")
  }

  it ("Delivers message to service", function*() {
    var req = mockEndpoint('/will_succeed', 200, 'Ok')
    yield hubClient.sendMessage({type: 'will_succeed'})
    yield hubHelpers.expectWithin(1000, req.isDone)
  })

  it ("Puts message in dead letter if maxAttempts reached", function*() {
    var req = mockEndpoint('/will_fail', 500, 'Failure', 5)
    yield hubClient.sendMessage({type: 'will_fail'})
    yield hubHelpers.expectWithin(200, function*() {
      var deadMessages = yield hub.repo.getService('sub').getDeadMessages()
      return deadMessages.length == 1
    })
  })

  it ("Re-delivers message to service if 2xx or 3xx not returned", function*() {
    var req = mockEndpoint('/will_fail', 500, 'Failure', 5)
    yield hubClient.sendMessage({type: 'will_fail'})
    yield hubHelpers.expectWithin(200, function() {
      return req.pendingMocks().length == 0
    })
  })
})
