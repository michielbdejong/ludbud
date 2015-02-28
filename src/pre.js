Ludbud = (function() {
  var ret = function(credentials){
    this.credentials = credentials;
  };
  function fail(str) {
    console.log('FAIL: '+str);
  }
