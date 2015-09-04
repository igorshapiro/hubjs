import Ember from 'ember';
import config from './config/environment';

var Router = Ember.Router.extend({
  location: config.locationType
});

Router.map(function() {

  // curl -XPOST -H"Content-Type: application/json" localhost:8080/api/v1/messages -d'{"type": "load_test", "content": {}}'
  this.resource('services', {path: '/services'}, function() {
    this.route('service', {path: ':service_id'}, function() {
      this.route('messages', {path: '/messages/:type'})
    })
  })
});

export default Router;
