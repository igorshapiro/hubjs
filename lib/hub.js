var route = require('koa-route')
var koa = require('koa')
var bodyParser = require('koa-bodyparser')
var rest = require('restler')

module.exports = function(options) {
  options = options || {}
  options.port = options.port || 8080

  var app = koa()
  app.use(bodyParser())
  app.use(route.post('/api/v1/messages', function*(){
    console.log(this.request.body)
    yield new Promise(function(resolve, reject) {
      rest.post("http://localhost:3100/something_done", this.request.body)
        .on('success', function(result, response) { resolve(response) })
        .on('fail', function(err, response) { reject(response) })
        .on('error', function(err, response) { reject(response) })
    })
    this.status = 201
  }))
  app.listen(options.port)
  console.log(`Listening on port ${options.port}`)
}
