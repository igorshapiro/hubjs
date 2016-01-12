"use strict"

var Bluebird = require('bluebird')

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
    }}, schedulePollingInterval: 100})
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

  describe ("api/services", function() {
    it ("returns list of services", function*() {
      var services = yield hubClient.getServices()
      expect(services).to.eql({
        services: [
          {id: "pub", name: "pub"},
          {id: "sub", name: "sub"}
        ]
      })
    })
  })

  describe ("scheduling", function() {
    describe ("deliverInMillis", function() {
      it ("will deliver the message only after deliverInMillis passed", function*(){
        var delay = 200
        var end
        mockEndpoint({path: "/will_succeed", status: function(uri, request, cb) {
          end = Date.now()
          this.status = 200
        }})
        var start = Date.now()
        yield hubClient.sendMessage({type: "will_succeed", deliverInMillis: delay})

        yield expect(function() {
          return end != null
        }).to.within(delay * 2).become(true)
        expect(end - start).to.be.above(delay)
      })
    })
  })

  describe ("api/dead", function() {
    beforeEach(function*(){
      var promises = []
      for (var i = 0; i < 30; i++)
        promises.push(hub.repo.getService("pub")
          .kill({type: 'will_succeed'})
        )
      yield promises
    })
    it ("returns dead messages", function*() {
      var msgs = yield hubClient.getDeadMessages("pub", {page: 2, pageSize: 25})
      var expectedArray = []
      for (var i = 0; i < 5; i++) {
        expectedArray.push({type: "will_succeed"})
      }
      expect(msgs).to.eql({
        stats: {total: 30},
        messages: expectedArray
      })
    })
  })

  describe ("api/processing", function() {
    it("returns messages being processed", function*() {
      mockEndpoint({path: "/will_succeed", delay: 50})
      var msgId = yield hubClient.sendMessage({type: 'will_succeed'})

      yield expect(function*() {
        var msgs = yield hubClient.getProcessingMessages("sub")
        return _.isEqual(msgs.stats, {total: 1}) &&
          _.isEqual(msgs.messages, [
            { messageType: 'will_succeed', id: msgId, maxAttempts: 5, attemptsMade: 0, env: "default",
              attemptDelays: config.msgDefaults.attemptDelays }
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
    yield hubClient.sendMessage({type: 'will_fail', attemptsMade: 2, attemptDelays: [4]})

    yield expect(function*(){
      var deadMessages = yield hub.repo.getService('sub').getDeadMessages()
      return deadMessages.messages.length == 1
    }).within(500).to.become(true)
  })

  describe ('Re-delivery using schedule if 2xx or 3xx not returned', () => {
    it ('delays each retry according to configuration', function* () {
      var timestamps = []
      var failingMock = mockEndpoint({ path: '/will_fail', status: 500, times: 5 })
        .filteringRequestBody(function(body) {
          timestamps.push(new Date().getTime())
          return body
        })

      var attemptDelaysMs = [50, 100, 300]

      yield hubClient.sendMessage({
        type: 'will_fail',
        maxAttempts: 4,
        attemptDelays: attemptDelaysMs
      })

      yield Bluebird.delay(_.sum(attemptDelaysMs) * 1.5)
      for (var i = 0; i < attemptDelaysMs.length; i++) {
        var actual = timestamps[i + 1] - timestamps[i]
        var expected = attemptDelaysMs[i]
        expect(actual).to.be.at.least(expected)
      }
    })
  })
})
