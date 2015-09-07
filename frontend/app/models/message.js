import DS from 'ember-data'

export default DS.Model.extend({
  content: DS.attr(),
  maxAttempts: DS.attr(),
  attemptsMade: DS.attr(),
  env: DS.attr(),
  messageType: DS.attr(),
  raw: DS.attr(),

  // Used to build the delete url. Can be dead|processing
  metaParams: DS.attr()
})
