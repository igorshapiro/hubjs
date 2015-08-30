var rest = require('restler')

module.exports = function(svc) {
  function getEndpoint(msg) {
    return svc.endpoint.replace(/\:type/, msg.messageType)
  }

  function *postToService(msg) {
    yield svc.startProcessing(msg)
    var endpoint = getEndpoint(msg)
    yield new Promise(function(resolve, reject) {
      rest.postJson(endpoint, msg)
        .on('success', function(result, response) { resolve(response) })
        .on('fail', function(data, response) {
          reject({
            status: response.statusCode,
            body: response.rawEncoded
          })
        })
        .on('error', function(err, response) { reject(err) })
    })
    yield svc.stopProcessing(msg)
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
    var endedAt = new Date().getTime()
    stats.timing(["hub.messages." + svc.name + "." + msg.messageType + ".response_time"], endedAt - startedAt)
  }
}
