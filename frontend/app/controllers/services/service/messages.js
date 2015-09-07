import Ember from 'ember';

export default Ember.Controller.extend({
  // didInsertElement: (function() {
  //   console.log("highlight")
  //   $("pre code").each(function(i, block) {
  //     console.log("Highlighting")
  //     hljs.highlightBlock(block)
  //   })
  // }).on("init"),
  queryParams: ['page'],
  actions: {
    expandMessage: function(msg) {
      msg.toggleProperty('_isExpanded')
      // debugger
      var tdSelector = "td[data-msg-id='" + msg.get('id') + "']"
      $(tdSelector).html("<pre><code class='json'></code></pre>")
      var codeSelector = tdSelector + " pre code"
      $(codeSelector).text(msg.get('raw'))
      hljs.highlightBlock($(codeSelector)[0])
    }
  }
});
