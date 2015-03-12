Ludbud = (function() {
  var ret = function(credentials){
    for(var i in credentials) {
      this[i] = credentials[i];
    }
  };

  ret.ERR_TIMEOUT = 'Ludbud.ERR_TIMEOUT';
  ret.ERR_ACCESS_DENIED = 'Ludbud.ERR_ACCESS_DENIED';
  ret.ERR_SERVER_ERROR = 'Ludbud.ERR_SERVER_ERROR';
  ret.ERR_NOT_FOUND = 'Ludbud.ERR_NOT_FOUND';
  ret.ERR_IS_FOLDER = 'Ludbud.ERR_IS_FOLDER';
  ret.ERR_NOT_A_FOLDER = 'Ludbud.ERR_NOT_A_FOLDER';

  function fail(str) {
    console.log('FAIL: '+str);
  }
