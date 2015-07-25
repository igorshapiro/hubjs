var rest = require('restler')

module.exports = {
  sendMessage: function*(msg) {
    yield new Promise(function(resolve, reject) {
      rest
        .postJson("http://localhost:8080/api/v1/messages", msg)
        .on('complete', function(data, response) {
          response.statusCode == 201 ? resolve() : reject(response)
        })
    })
  }
}
