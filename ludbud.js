Ludbud = (function() {
  var ret = {};
  function fail(str) {
    console.log('FAIL: '+str);
  }
function requestJSON(url, callback) {
  var xhr = new XMLHttpRequest();
  xhr.open('GET', url);
  xhr.responseType = 'json';
  xhr.onload = function() {
    callback(null, xhr.response);
  };
  xhr.send();
}
function Instance(token, platform) {
  this.isConnected = true;
  this.token = token;
  this.platform = platform;
}
Instance.prototype.getInfo = function(path, callback) {
  callback('not implemented yet!');
};
var apiCredentials = {};
ret.setApiCredentials = function(platform, credentials) {
  apiCredentials[platform] = credentials;
}
function getClientId(platform) {
  if (platform === 'remotestorage') {
    return window.location.origin;
  } else {
    return apiCredentials[platform];
  }
}
ret.oauth = function(platform, userAddress, scopes) {
  function goTo(baseURL) {
    var hashPos = document.location.href.indexOf('#'),
        hash = (hashPos === -1 ? '' : document.location.href.substring(hashPos));
    window.location = baseURL
        + '?redirect_uri=' + encodeURIComponent(document.location.href.replace(/#.*$/, ''))
        + '&scope=' + encodeURIComponent(scopes || '*:rw')
        + '&client_id=' + encodeURIComponent(getClientId(platform))
        + '&state=' + encodeURIComponent(platform+hash)
        + '&response_type=token';
  }
  if (platform === 'dropbox') {
    goTo('https://www.dropbox.com/1/oauth2/authorize');
  } else if (platform === 'google') {
    goTo('https://accounts.google.com/o/oauth2/auth');
  } else if (platform === 'remotestorage') {
    var parts = userAddress.split('@');
    requestJSON('https://' + parts[1] + '/.well-known/webfinger?resource='+encodeURIComponent('acct:'+userAddress), function(err, data) {
      if (err) {
        fail('error retrieving webfinger for '+userAddress, err);
      } else if (typeof data === 'object' && Array.isArray(data.links)) {
        for (var i=0; i< data.links.length; i++) {
          if (typeof data.links[i] === 'object'
              && data.links[i].rel === 'remotestorage'
              && typeof data.links[i].properties === 'object'
              && typeof data.links[i].properties['http://tools.ietf.org/html/rfc6749#section-4.2'] === 'string') {
            goTo(data.links[i].properties['http://tools.ietf.org/html/rfc6749#section-4.2']);
            return;
          }
        }
      } else {
        fail('error parsing webfinger for '+userAddress + JSON.stringify(data));
      }
    });
  } else {
    fail('unknown platform '+platform);
  }
}
ret.fromWindowLocation = function() {
  var hashPos = window.location.href.indexOf('#');
  if (hashPos === -1) {
    return {};
  }
  var parsed = {},
      pairs = window.location.href.substring(hashPos+1).split('&');
  for(var i=0; i<pairs.length; i++) {
    var parts = pairs[i].split('=');
    parsed[parts[0]] = decodeURIComponent(parts[1]);
  }
  if (parsed['state']) {
    var stateParts = parsed['state'].split('#');
    if (stateParts.length === 1) {//restore fact that there was no hash:
      window.location = window.location.href.substring(0, hashPos);
    } else {//restore hash as it was (even if the hash contained the hash sign):
      var hashPos2 = parsed['state'].indexOf('#');
      window.location = parsed['state'].substring(hashPos2);
    }
    return new Instance(parsed['access_token'], stateParts[0]);
  }
  return {};
}
  return ret;
})();
