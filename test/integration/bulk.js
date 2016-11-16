var Scenario = require('./scenario')
var shortid = require('shortid')

describe('Bulk', function() {
  var hubScenario, msgName
  beforeEach(function*() {
    hubScenario = Scenario()
    msgName = `bulkTest${shortid.generate()}`
  })

  afterEach(function*() {
    yield hubScenario.reset()
  })

  it('Delivers bulk messages to server', function*() {
    yield hubScenario.forHub()
      .withSubscriber(msgName, {bulk: 2}).at('/handlers/:type')
      .whenSendingMessage({type: msgName})
      .whenSendingMessage({type: msgName})
      .withPredicate(function(scenario) {
        var requestsMade = scenario.requestsMade
        if (requestsMade.length !== 1) {
          return {
            passed: false,
            error: `${requestsMade.length} requests received. Expected: 1` }
        }
        var msg = JSON.parse(requestsMade[0].body)
        return {
          passed: msg.content.length === 2,
          error: `${msg.content.length} messages in bulk. Exepected: 2`
        }
      })
      .run()
  })
})
