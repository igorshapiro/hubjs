function poll(deadline, predicateCallback, resolve, reject) {
  var promise
  if (predicateCallback.constructor.name === 'GeneratorFunction')
    promise = co(predicateCallback)
  else
    promise = Promise.resolve(predicateCallback())

  promise
    .then(function (result) {
      if (result) return resolve(result)
      if (new Date().getTime() > deadline)
        return reject(new Error("Predicate didn't return true within timeout"))
      setTimeout(function() {
        poll(deadline, predicateCallback, resolve, reject)
      }, 0)
    })
    .catch(reject)
}

module.exports = function(chai, utils) {
  var Assertion = chai.Assertion
  Assertion.addChainableMethod('within', function(timeoutMillis) {
    var deadline = new Date().getTime() + timeoutMillis
    var callback = utils.flag(this, 'object')
    var promise = new Promise(function(resolve, reject) {
      poll(deadline, callback, resolve, reject)
    })
    utils.flag(this, 'object', promise)
  })
}
