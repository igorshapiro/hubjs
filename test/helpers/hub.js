var route = require('koa-route')
var koa = require('koa')
var Hub = require('../../lib/hub.js')

function poll(deadline, predicateCallback, resolve, reject) {
  if (predicateCallback())
    return resolve("Done")
  if (new Date().getTime() > deadline)
    return reject(new Error("Predicate failed"))
  setTimeout(function() {
    poll(deadline, predicateCallback, resolve, reject)
  }, 0)
}

module.exports = {
  // Expects `predicateCallback` to return true within `timeoutMillis` ms
  expectWithin: function*(timeoutMillis, predicateCallback) {
    var deadline = new Date().getTime() + timeoutMillis

    yield new Promise(function(resolve, reject) {
      poll(deadline, predicateCallback, resolve, reject)
    })
  },

  startHub: function(options) {
    return new Hub(options)
  },

  // handlersMap = {
  //   '/': {
  //     post: function(...)
  //   }
  // }
  withinTestService: function(port, handlersMap) {
    var app = koa()
    for (var path in handlersMap) {
      var methods = handlersMap[path]
      for (var method in methods) {
        var handler = methods[method]
        var rt = route[method](path, handler)
        app.use(rt)
      }
    }
  }
}
