var rest = require('restler')

module.exports = function(svc) {
  function getEndpoint(msg) {
    return svc.endpoint.replace(/\:type/, msg.type)
  }

  function *postToService(msg) {
    yield svc.startProcessing(msg)
    var endpoint = getEndpoint(msg)
    yield new Promise(function(resolve, reject) {
      rest.post(endpoint, msg)
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
    msg.attemptsMade += 1
    if (msg.attemptsMade >= msg.maxAttempts) {
      yield svc.kill(msg)
    }
    else {
      yield svc.enqueueInput(msg)
    }
  }

  return function*(msg) {
    try {
      yield postToService(msg)
    }
    catch (err) {
      yield handleError(msg, err)
    }
  }
}
