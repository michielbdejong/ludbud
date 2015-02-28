Ludbud = (function() {
  var ret = function(credentials){
    for(var i in credentials) {
      this[i] = credentials[i];
    }
  };
  function fail(str) {
    console.log('FAIL: '+str);
  }
