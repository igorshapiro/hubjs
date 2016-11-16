var shortid = require('shortid')
var Recurring = require('./../../lib/middlewares/recurring')
var Hub = require('./../../lib/hub/hub')

describe('Recurring', function() {
  var service
  var hub = new Hub({manifest: {}})
  var recurring

  beforeEach(function*() {
    service = { name: shortid.generate() }
    recurring = new Recurring({
      service: service,
      hub: hub,
      instanceName: shortid.generate()
    })
    yield recurring.initialize()
  })

  function *getOnlyMessage() {
    var messages = yield recurring.getMessages()
    expect(messages.length).to.equal(1)
    return messages[0]
  }

  it('Updates recurring message on second call', function*() {
    var msg = {messageType: 'recurring', deliveryEveryMillis: 10000}
    yield recurring.register(msg)
    msg.deliveryEveryMillis = 20000
    yield recurring.register(msg)
    msg = yield getOnlyMessage()
    expect(msg.message.deliveryEveryMillis).to.equal(20000)
  })
})
