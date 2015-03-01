Ludbud = (function() {
  var ret = function(credentials){
    for(var i in credentials) {
      this[i] = credentials[i];
    }
  };

  ret.ERR_TIMEOUT = 'ERR_TIMEOUT';
  ret.ERR_ACCESS_DENIED = 'ERR_ACCESS_DENIED';
  ret.ERR_SERVER_ERROR = 'ERR_SERVER_ERROR';
  ret.ERR_NOT_FOUND = 'ERR_NOT_FOUND';
  ret.ERR_IS_FOLDER = 'ERR_IS_FOLDER';
  ret.ERR_NOT_A_FOLDER = 'ERR_NOT_A_FOLDER';

  function fail(str) {
    console.log('FAIL: '+str);
  }
