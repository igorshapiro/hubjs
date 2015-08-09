describe('ServiceHub', function() {
  var svcHost = "http://localhost:3100"
  var CONCURRENCY = 5

  var hub = null
  before(function*() {
    hub = new Hub({manifest: {services: {
      pub: {
        publishes: ['will_succeed', 'will_fail']
      },
      sub: {
        subscribes: ['will_succeed', 'will_fail'],
        concurrency: CONCURRENCY
      }
    }}})
    yield hub.start()
  })

  beforeEach(function*() {
    yield hub.hardReset()
  })

  afterEach(nock.cleanAll)

  function mockEndpoint(path, status, msg, times) {
    var req = nock(svcHost).post(path)
    if (times)
      req = req.times(times)
    return req.reply(status, msg || "")
  }

  it ("Doesn't send more than `concurrency` messages", function*() {
    var TEN_SECONDS = 10000

    var counter = 0
    var req = mockEndpoint("/will_succeed", function(uri, request, cb) {
      counter++
      setTimeout(function() {
        cb(null, [200, "Ok"])
      }, TEN_SECONDS)
    }, "", 10)


    yield _(CONCURRENCY * 2).range().map(function() {
      return hubClient.sendMessage({type: 'will_succeed'})
    }).value()

    yield hubHelpers.expectAfter(200, function() {
      return test.number(counter).is(CONCURRENCY)
    })
  })

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
