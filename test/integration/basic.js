describe('ServiceHub', function() {
  var svcHost = "http://localhost:3100"
  var CONCURRENCY = 5
  var TEN_SECONDS = 10000

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

  function mockEndpoint(options) {
    var req = nock(svcHost).post(options.path)
    if (options.times) req = req.times(options.times)
    if (options.delay) req = req.delay(options.delay)
    return req.reply(options.status || 200, options.msg || "Ok")
  }

  describe ("api/processing", function() {
    it("returns messages being processed", function*() {
      mockEndpoint({path: "/will_succeed", delay: 50})
      var msgId = yield hubClient.sendMessage({type: 'will_succeed'})

      yield expect(function*() {
        var msgs = yield hubClient.getProcessingMessages("sub")
        return _.isEqual(msgs.stats, {total: 1}) &&
          _.isEqual(msgs.messages, [
            {messageType: 'will_succeed', id: msgId, maxAttempts: 5, attemptsMade: 0, env: "default"}
          ])
      }).within(30).to.become(true)

      yield expect(function*() {
        var msgs = yield hubClient.getProcessingMessages("sub")
        return _.isEqual(msgs.stats, {total: 0}) &&
          _.isEqual(msgs.messages, [])
      }).within(100).to.become(true)

    })
  })

  it ("Doesn't send more than `concurrency` messages", function*() {
    var counter = 0
    var req = mockEndpoint({
      path: "/will_succeed",
      status: function(uri, request, cb) {
        counter++
        setTimeout(function() {
          cb(null, [200, "Ok"])
        }, TEN_SECONDS)
      },
      times: 10
    })

    for (var i = 0; i < CONCURRENCY * 2; i++) {
      yield hubClient.sendMessage({type: 'will_succeed'})
    }

    yield expect(function() {
      return counter == CONCURRENCY
    }).within(200).to.become(true)
  })

  it ("Delivers message to service", function*() {
    var req = mockEndpoint({path: '/will_succeed'})
    yield hubClient.sendMessage({type: 'will_succeed', attemptsMade: 3})
    yield expect(req.isDone).to.within(200).become(true)
  })

  it ("Puts message in dead letter if maxAttempts reached", function*() {
    var req = mockEndpoint({path: '/will_fail', status: 500, msg: 'Failure', times: 4})
    yield hubClient.sendMessage({type: 'will_fail', attemptsMade: 1})

    yield expect(function*(){
      var deadMessages = yield hub.repo.getService('sub').getDeadMessages()
      return deadMessages.length == 1
    }).within(200).to.become(true)
  })

  it ("Re-delivers message to service if 2xx or 3xx not returned", function*() {
    var req = mockEndpoint({path: '/will_fail', status: 500, msg: 'Failure', times: 5})
    yield hubClient.sendMessage({type: 'will_fail'})
    yield expect(function() { return req.pendingMocks.length == 0 } )
      .within(200).to.become(true)
  })
})
