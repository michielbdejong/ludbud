var platformCredentials = {};
ret.setPlatformCredentials = function(platform, credentials) {
  platformCredentials[platform] = credentials;
}
ret.createCredentials = function(platform, host, user, pass) {
  fail('WARNING: platform ' + platform + ' not fully supported yet');
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
      fail('You need to add hoodie.js to your page for this to work, get it from https://hood.ie/');
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
  if (platform !== 'remotestorage' && platform !== 'remotestorage-allow-insecure-webfinger') {
    fail('WARNING: platform ' + platform + ' not fully supported yet');
  }
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
  } else if (platform === 'remotestorage' || platform === 'remotestorage-allow-insecure-webfinger') {

    var webfinger = new WebFinger({
      tls_only: (platform === 'remotestorage' ? true : false)
    });
    webfinger.lookup(userAddress, function (err, p) {
      if (err) {
        fail('error retrieving webfinger for '+userAddress, err);
      } else {
        //webfinger.js will now guarantee:
        // (typeof p.idx === 'object') &&
        // (typeof p.idx.links == 'object') &&
        // (Array.isArray(p.idx.links.remotestorage))
        for (var i=0; i< p.idx.links.remotestorage.length; i++) {
          //webfinger will now guarantee:
          // (typeof p.idx.links.remotestorage[i] === 'object')
          if (typeof p.idx.links.remotestorage[i].href === 'string'
              && typeof p.idx.links.remotestorage[i].properties === 'object'
              && typeof p.idx.links.remotestorage[i].properties['http://tools.ietf.org/html/rfc6749#section-4.2'] === 'string') {
            apiBaseURL = p.idx.links.remotestorage[i].href;
            goTo(p.idx.links.remotestorage[i].properties['http://tools.ietf.org/html/rfc6749#section-4.2']);
            return;
          }
        }
      }
      fail('error parsing webfinger for '+userAddress + JSON.stringify(p));
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
    }
  }
}
ret.restoreWindowLocation = function() {
  window.location = windowLocationToRestore;
}
