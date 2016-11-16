var koa = require('koa')
var app = koa()

app.use(function*(next) {
  return this.status === 200
})

app.listen(3100)
