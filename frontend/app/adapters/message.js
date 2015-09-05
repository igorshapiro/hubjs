import ApplicationAdapter from './application';

export default ApplicationAdapter.extend({
  buildURL: function(model, id, snapshot, requestType, query) {
    console.log(this.host)
    console.log(this.namespace)
    console.log(model)
    console.log(id)
    console.log(snapshot)
    console.log(requestType)
    console.log(query)

    if (model == "message" && requestType == "deleteRecord") {
      var params = snapshot.get('metaParams')
      console.log(params)
      var url = this.host + "/" + this.namespace + "/messages/" +
        params.service + "/" + params.type + "/" + snapshot.id
      console.log(url)
      return url
    }

    return this._super(model, id, snapshot, requestType, query)
  }
});
