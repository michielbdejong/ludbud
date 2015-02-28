Ludbud = (function() {
  var ret = function(credentials){
    this.credentials = credentials;
  };
  function fail(str) {
    console.log('FAIL: '+str);
  }
function request(method, url, token, payload, header, callback) {
  var xhr = new XMLHttpRequest();
  xhr.open(method, url);
  xhr.setRequestHeader('Authorization', 'Bearer '+token);
  xhr.onload = function() {
    callback(null, {
      info: {
        'Content-Type': xhr.getResponseHeader('Content-Type'),
	'Content-Length': xhr.getResponseHeader('Content-Length'),
        ETag: xhr.getResponseHeader('ETag'),
        isFolder: url.substr(-1) === '/'
      },
      body: xhr.response
    });
  };
  xhr.send();
}
function requestJSON(url, token, callback) {
  var xhr = new XMLHttpRequest();
  xhr.open('GET', url);
  xhr.responseType = 'json';
  if (token) {
    xhr.setRequestHeader('Authorization', 'Bearer '+token);
  }
  xhr.onload = function() {
    callback(null, xhr.response);
  };
  xhr.send();
}
ret.prototype.makeURL = function(dataPath) {
  return this.credentials.apiBaseURL + dataPath;
};
ret.prototype.getInfo = function(dataPath, callback) {
  request('HEAD', this.makeURL(dataPath), this.credentials.token, undefined, {}, function(err, data) {
    if (err) {
      callback(err);
    } else {
      callback(err, data.info);
    }
  });
};
ret.prototype.getBody = function(dataPath, callback) {
  request('GET', this.makeURL(dataPath), this.credentials.token, undefined, {}, function(err, data) {
    if (err) {
      callback(err);
    } else {
      callback(err, data.body);
    }
  });
};
ret.prototype.getFolder = function(dataPath, callback) {
  requestJSON(this.makeURL(dataPath), this.credentials.token, function(err, data) {
    if (err) {
      callback(err);
    } else {
      callback(err, data.items);
    }
  });
};
ret.prototype.create = function(dataPath, content, contentType, callback) {
  request('PUT', this.makeURL(dataPath), this.credentials.token, content, {
     'Content-Type': contentType
  }, function(err, data) {
    console.log('PUT result', err, data);
    callback(err, (data && data.info ? data.info.ETag : undefined));
  });
};
ret.prototype.update = function(dataPath, content, contentType, existingETag, callback) {
  request('PUT', this.makeURL(dataPath), this.credentials.token, content, {
     'Content-Type': contentType,
     'If-Match': existingETag
  }, function(err, data) {
    callback(err, (data && data.info ? data.info.ETag : undefined));
  });
};
ret.prototype.remove = function(dataPath, existingETag, callback) {
  request('DELETE', this.makeURL(dataPath), this.credentials.token, undefined, {
     'If-Match': existingETag
  }, callback);
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
  return ret;
})();
