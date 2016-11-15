require('./../config/init')
var config = require('./../config/config')
var Hub = require('./hub/hub')
var co = require('co')

co(function*() {
  console.log('Starting ServiceHub')
  var hub = new Hub({ config: config })
  yield hub.run()
})
.catch(_ => log.error(_))

console.log('Press Enter to allow process to terminate')
process.stdin.once('data', callback)

function callback(data) {
  console.log('Process can terminate now')
  process.stdin.unref()
}
