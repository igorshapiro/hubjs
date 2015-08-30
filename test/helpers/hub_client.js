var rest = require('restler')

function handleHttpResponse(req) {
  return new Promise(function(resolve, reject) {
    req.on('success', function(data, response) {
      var success = [200, 201].indexOf(response.statusCode) != -1
      success ? resolve(data) : reject(new Error(response))
    })
    .on('error', function(err, response) {
      reject(new Error(err))
    })
    .on('fail', function(data, response) {
      reject(new Error(data))
    })
  })
}

module.exports = {
  sendMessage: function*(msg) {
    return handleHttpResponse(
      rest.postJson("http://localhost:8080/api/v1/messages", msg)
    )
  },

  getProcessingMessages: function*(serviceName) {
    return handleHttpResponse(
      rest.get(`http://localhost:8080/api/v1/${serviceName}/processing`)
    )
  }
}
