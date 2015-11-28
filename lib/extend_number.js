// Based on agave.js
const SECONDS = 1000
const MINUTES = 60 * SECONDS
const HOURS = 60 * MINUTES
const DAYS = 24 * HOURS
const WEEKS = 7 * DAYS

// Convert Number to (function name). +ensures type returned is still Number
function seconds() { return +this * SECONDS }
function minutes() { return +this * MINUTES }
function hours() { return +this * HOURS }
function days() { return +this * DAYS }
function weeks() { return +this * WEEKS }

// Helper function for before() and after()
function getTimeOrNow(date) {
  return (date || new Date()).getTime()
}

// Return Number of seconds to time delta from date (or now if not specified)
function before(date) {
  var time = getTimeOrNow(date)
  return new Date(time - (+this))
}

// Return Number of seconds to time delta after date (or now if not specified)
function after(date) {
  var time = getTimeOrNow(date)
  return new Date(time + (+this))
}

function extendNumber(name, method) {
  Object.defineProperty(Number.prototype, name, { value: method, enumerable: false, writable: true })
}

extendNumber('seconds', seconds)
extendNumber('minutes', minutes)
extendNumber('hours', hours)
extendNumber('days', days)
extendNumber('weeks', weeks)
extendNumber('before', before)
extendNumber('after', after)
