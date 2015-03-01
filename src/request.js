function request(method, url, responseType, payload, headers, callback) {
  var xhr = new XMLHttpRequest(), calledBack = false;
  xhr.open(method, url);
  xhr.responseType = responseType;
  xhr.timeout = 10000;
  for (var i in headers) {
    xhr.setRequestHeader(i, headers[i]);
  }
  xhr.ontimeout = function(evt) {
    if (calledBack) {
      return;
    }
    ret.fail('request timeout', evt, xhr.status);
    callback(ret.ERR_TIMEOUT);
    calledBack = true;
  };
   
  xhr.onerror = function(evt) {
    if (calledBack) {
      return;
    }
    
    ret.fail('request error', evt, xhr.status);
    callback(ret.ERR_TIMEOUT);
    calledBack = true;
  };
   
  xhr.onabort = function(evt) {
    if (calledBack) {
      return;
    }
    ret.fail('request abort', evt, xhr.status);
    callback(ret.ERR_TIMEOUT);
    calledBack = true;
  };
   
  xhr.onload = function() {
    if (calledBack) {
      return;
    }
    if (xhr.status >= 500) { // treat any 500+ response code as server error
      callback(ret.ERR_SERVER_ERROR);
    } else if (xhr.status === 404) { // special case for 404s
      callback(ret.ERR_NOT_FOUND);
    } else if (xhr.status >= 400) { // and rest of 400 range as access denied
      callback(ret.ERR_ACCESS_DENIED);
    } else { // now treat any response code under 400 as successful
      callback(null, {
        info: {
          'Content-Type': xhr.getResponseHeader('Content-Type'),
          'Content-Length': xhr.getResponseHeader('Content-Length'),
          ETag: xhr.getResponseHeader('ETag'),
          isFolder: url.substr(-1) === '/'
        },
        body: xhr.response
      });
    }
    calledBack = true;
  };
  xhr.send();
}
//convenience methods that wrap around request:
function requestJSON(url, token, callback) {
  var header = {};
  if (token) {
    headers.Authorization =  'Bearer '+token;
  }
  return request('GET', url, 'json', undefined, headers, function(err, data) {
    return callback(err, (typeof data === 'object' ? data.body : data));
  });
}
function requestArrayBuffer(method, url, token, payload, headers, callback) {
  if (token) {
    headers.Authorization =  'Bearer '+token;
  }
console.log('headers', headers);
  return request(method, url, 'arraybuffer', payload, headers, callback);
}
