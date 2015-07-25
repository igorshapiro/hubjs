var RabbitMQTransport = require('./rabbitmq')

function Pool() {
  this.cache = {}

  this.get = function*(url) {
    cached = this.cache[url]
    if (cached) return cached

    var transport
    if (url.startsWith("rabbitmq://"))
       transport = new RabbitMQTransport(url)
    else
      throw new Error(`Unknown transport url: ${url}`)
    yield transport.initialize()

    this.cache[url] = transport
    return transport
  }
}

module.exports = new Pool()
