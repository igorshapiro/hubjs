var Promise = require('bluebird')
var request = Promise.promisifyAll(require('request'))

module.exports = function(svc) {
  function getEndpoint(msg) {
    return svc.endpoint.replace(/\:type/, msg.messageType)
  }

  function *postToService(msg) {
    var endpoint = getEndpoint(msg)
    var responseAndBody = yield request.postAsync({
      url: endpoint,
      forever: true,
      json: msg
    })
    var response = responseAndBody[0]
    var body = responseAndBody[1]
    if (response.statusCode / 100 != 2) {
      var error = new Error(body)
      error.statusCode = response.statusCode
      throw error
    }
    return body
  }

  function *handleError(msg, err) {
    log.error({message: msg, error: err}, "Failed handling message")
    msg.attemptsMade += 1
    if (msg.attemptsMade >= msg.maxAttempts) {
      yield svc.kill(msg)
      stats.increment(['hub.messages.killed', "hub." + svc.name + ".messages.killed"])
    }
    else {
      yield svc.enqueueInput(msg)
      stats.increment(['hub.messages.failed', "hub." + svc.name + ".messages.failed"])
    }
  }

  return function*(msg) {
    yield svc.startProcessing(msg)
    var startedAt = new Date().getTime()
    stats.increment(['hub.messages.total', "hub." + svc.name + ".messages.total"])
    try {
      yield postToService(msg)
      if (msg.attemptsMade > 0) {
        stats.histogram([
          'hub.messages.retries',
          'hub.' + svc.name + '.messages.retries',
          'hub.' + svc.name + '.messages.' + msg.messageType + '.retries'
        ], msg.attemptsMade)
      }
      stats.increment(['hub.messages.succeeded', "hub." + svc.name + ".messages.succeeded"])
    }
    catch (err) {
      yield handleError(msg, err)
    }
    finally {
      yield svc.stopProcessing(msg)
    }
    var endedAt = new Date().getTime()
    stats.timing(["hub.messages." + svc.name + "." + msg.messageType + ".response_time"], endedAt - startedAt)
  }
}
