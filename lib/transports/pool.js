var RabbitMQTransport = require('./rabbitmq')
var RedisTransport = require('./redis')
var MongoTransport = require('./mongo')

function Pool() {
  this.cache = {}

  this.get = function*(url) {
    cached = this.cache[url]
    if (cached) return cached

    var transport
    if (url.indexOf("rabbitmq://") == 0)
       transport = new RabbitMQTransport(url)
    else if (url.indexOf("redis://") == 0)
      transport = new RedisTransport(url)
    else if (url.indexOf("mongo://") == 0)
      transport = new MongoTransport(url)
    else
      throw new Error("Unknown transport url: " + url)
    yield transport.initialize()

    this.cache[url] = transport
    return transport
  }
}

module.exports = new Pool()
