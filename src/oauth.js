var platformCredentials = {};
ret.setPlatformCredentials = function(platform, credentials) {
  platformCredentials[platform] = credentials;
}
ret.createCredentials = function(platform, host, user, pass) {
   var obj = {
    platform: platform
  };
  if (platform === 'owncloud') {
    obj.apiBaseURL = 'https://'
          + encodeURIComponent(user)
          + ':'
          + encodeURIComponent(pass)
          + '@'
          + host
          + '/ocs/v1.php/apps/files_sharing/api/v1';
  } else if (platform === 'hoodie') {
    if (!Hoodie) {
      console.log('You need to add hoodie.js to your page for this to work, get it from https://hood.ie/');
    }
    obj.host = host;
    obj.user = user;
    obj.pass = pass;
  }
  return obj;
}

function getClientId(platform) {
  if (platform === 'remotestorage') {
    return window.location.origin;
  } else {
    return platformCredentials[platform];
  }
}
ret.oauth = function(platform, userAddress, scopes) {
  var apiBaseURL;
  function goTo(oauthBaseURL) {//this uses some variables from its parent scope
    var hashPos = document.location.href.indexOf('#'),
        hash = (hashPos === -1 ? '' : document.location.href.substring(hashPos));
    window.location = oauthBaseURL
        + '?redirect_uri=' + encodeURIComponent(document.location.href.replace(/#.*$/, ''))
        + '&scope=' + encodeURIComponent(scopes || '*:rw')
        + '&client_id=' + encodeURIComponent(getClientId(platform))
        + '&state=' + encodeURIComponent(JSON.stringify({
            platform: platform,
            hash: hash,
            apiBaseURL: apiBaseURL
          }))
        + '&response_type=token';
  }
  if (platform === 'dropbox') {
    goTo('https://www.dropbox.com/1/oauth2/authorize');
  } else if (platform === 'googledrive') {
    goTo('https://accounts.google.com/o/oauth2/auth');
  } else if (platform === 'remotestorage') {
    var parts = userAddress.split('@');
    requestJSON('https://' + parts[1] + '/.well-known/webfinger?resource='+encodeURIComponent('acct:'+userAddress),
        undefined, function(err, data) {
      if (err) {
        fail('error retrieving webfinger for '+userAddress, err);
      } else if (typeof data === 'object' && Array.isArray(data.links)) {
        for (var i=0; i< data.links.length; i++) {
          if (typeof data.links[i] === 'object'
              && data.links[i].rel === 'remotestorage'
              && typeof data.links[i].properties === 'object'
              && typeof data.links[i].properties['http://tools.ietf.org/html/rfc6749#section-4.2'] === 'string') {
            apiBaseURL = data.links[i].href;
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
var windowLocationToRestore;
ret.fromWindowLocation = function() {
  var hashPos = window.location.href.indexOf('#');
  if (hashPos === -1) {
    return;
  }
  var parsed = {},
      pairs = window.location.href.substring(hashPos+1).split('&');
  for(var i=0; i<pairs.length; i++) {
    var parts = pairs[i].split('=');
    parsed[parts[0]] = decodeURIComponent(parts[1]);
  }
  if (parsed['state']) {
    try {
      var stateObj = JSON.parse(parsed['state']);
console.log(parsed, stateObj);
      if (stateObj.hash) { // restore hash as it was:
        windowLocationToRestore = stateObj.hash;
      } else { // restore fact that there was no hash:
        windowLocationToRestore = window.location.href.substring(0, hashPos);
      }
      return {
        platform: stateObj.platform,
        token: parsed['access_token'],
        apiBaseURL: stateObj.apiBaseURL
      };
    } catch(e) {
console.log(parsed, e);
    }
  }
}
ret.restoreWindowLocation = function() {
  window.location = windowLocationToRestore;
}
