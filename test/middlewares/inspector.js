var shortid = require('shortid')
var Inspector = require('./../../lib/middlewares/inspector')
var Hub = require('./../../lib/hub/hub')
const EventEmitter = require('events')

describe('Inspector', function() {
  var service, inspector
  var hub = new Hub({manifest: {}})

  beforeEach(function*() {
    service = { name: shortid.generate() }
    inspector = new Inspector({
      service: service,
      hub: hub,
      instanceName: shortid.generate()
    })
  })

  describe('Handle', function() {
    it('matchers', function() {
      var msg = {type: 'done', num: 4}
      inspector.setMatchers(['ctx.type === \'done\' && ctx.num < 10'])
      inspector.logEvent = sinon.spy()
      inspector.handle('some_type', msg)

      expect(inspector.logEvent).to.have.been.calledWith('some_type', msg)
    })

    it('does not match', function() {
      inspector.setMatchers(['ctx.type === \'done\''])
      inspector.logEvent = sinon.spy()
      inspector.handle('some_type', {type: 'not_done'})

      expect(inspector.logEvent).to.not.have.been.called
    })
  })

  describe('Subscription', function() {
    function testSubscription(middleware, msgType, name) {
      return function*() {
        var emitter = new EventEmitter()
        inspector[name] = emitter

        var spy = sinon.spy()
        inspector.handle = spy
        var ev = { id: shortid.generate() }

        yield inspector.initialize()
        emitter.emit(msgType, ev)

        expect(spy).to.have.been.calledWith(msgType, ev)
      }
    }

    var eventTypes = [
      { mw: 'delivery', name: 'delivery', type: 'delivered' },
      { mw: 'dead_letter', name: 'deadLetter', type: 'killed' },
      { mw: 'scheduler', name: 'scheduler', type: 'scheduled' },
      { mw: 'scheduler', name: 'scheduler', type: 'enqueued' },
      { mw: 'api', name: 'api', type: 'accepted' }
    ]

    for (var eventType of eventTypes) {
      it(`Subscribes to ${eventType.mw}.${eventType.type}`,
        testSubscription(eventType.mw, eventType.type, eventType.name)
      )
    }
  })
})
