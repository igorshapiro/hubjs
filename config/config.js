module.exports = {
  newrelic: false,
  msgDefaults: {
    maxAttempts: 5,
    env: "default",
    attemptDelays: [ (30).seconds(), (2).minutes(), (10).minutes(), (30).minutes() ]
  }
}
