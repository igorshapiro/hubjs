var route = require('koa-route')
var co = require('co')
var koa = require('koa')
var Hub = require('../../lib/hub.js')

module.exports = {
  startHub: function(options) {
    return new Hub(options)
  }
}
