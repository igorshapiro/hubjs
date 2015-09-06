import ApplicationAdapter from './application';

export default ApplicationAdapter.extend({
  buildURL: function(model, id, snapshot, requestType, query) {
    if (model == "message" && requestType == "deleteRecord") {
      var params = snapshot.get('metaParams')
      var url = this.host + "/" + this.namespace + "/messages/" +
        params.service + "/" + params.type + "/" + snapshot.id
      if (params.reenqueue)
        url += "?reenqueue=true"
      return url
    }

    return this._super(model, id, snapshot, requestType, query)
  }
});
