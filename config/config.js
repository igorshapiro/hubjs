module.exports = {
  newrelic: false,
  msgDefaults: {
    maxAttempts: 5,
    env: "default",
    attemptDelays: [ (5).seconds(), (3).minutes(), (30).minutes(), (6).hours() ]
  }
}
