describe('ServiceHub', function() {
  var hub = null
  before(function*() {
    hub = new Hub()
  })

  it ("Delivers message to service", function*() {
    var req = nock('http://localhost:3100')
      .post('/something_done')
      .reply(200, 'Ok')

    yield hubClient.sendMessage({type: 'something_done'})
    yield hubHelpers.expectWithin(200, req.isDone)
  })
})
