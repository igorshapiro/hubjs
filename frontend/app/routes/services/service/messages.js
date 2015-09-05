import Ember from 'ember'
import PaginationMixin from 'ember-cli-pagination/remote/route-mixin'

export default Ember.Route.extend(PaginationMixin, {
  perPage: 25,

  queryParams: {
    page: { refreshModel: true }
  },
  model: function(params, transition) {
    var service = this.modelFor('services.service')
    return this.findPaged('message', {
      type: params.type,
      service: service.get('id'),
      page: params.page
    })
  },

  actions: {
    delete: function(msg) {
      var params = this.get('context.otherParams')
      msg.set('metaParams', params)
      // console.log()
      msg.destroyRecord()
        .then(function() {
          console.log("Deleted")
        })
    }
  }
})
