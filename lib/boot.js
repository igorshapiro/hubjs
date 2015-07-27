var Hub = require('./hub')
var co = require('co')

co(function*() {
  var hub = new Hub()
  yield hub.start()
})
  .catch(function (err) { log.error(err) })

console.log('Press Enter to allow process to terminate')
process.stdin.once('data', callback)

function callback (data) {
    console.log('Process can terminate now')
    process.stdin.unref()
}
