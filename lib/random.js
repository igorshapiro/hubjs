var crypto = require('crypto');
var co = require('co');

function spawnTokenBuf(n) {
    return function(callback) {
        crypto.randomBytes(n, callback);
    };
}

module.exports = {
  hex: function*(n) {
    return (yield spawnTokenBuf(n)).toString('hex')
  }
}
