var URL = require('url')
var amqp = require('amqplib');

module.exports = function(url) {
  var url = URL.parse(url)
  var port = url.port || 5672
  var _this = this

  this.enqueue = function*(queue, msg) {
    this.channel.publish('', queue, new Buffer(JSON.stringify(msg)))
  }

  this.initialize = function*() {
    var auth = ""
    if (url.auth) auth = url.auth + "@"
    var amqpUrl = "amqp://" + auth + url.hostname + ":" + port
    console.log("Connecting to " + amqpUrl)
    try{
      this.connection = yield amqp.connect(amqpUrl)
      this.channel = yield this.connection.createChannel()
      console.log("Connected to " + amqpUrl)
    }
    catch (ex) {
      console.log("Failure")
      console.log(ex)
    }
  }
}
