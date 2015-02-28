function request(method, url, token, payload, headers, callback) {
  console.log('request', method, url, token, payload, headers, callback);
  var xhr = new XMLHttpRequest();
  xhr.open(method, url);
  xhr.responseType = 'arraybuffer';
  if (token) {
    xhr.setRequestHeader('Authorization', 'Bearer '+token);
  }
  for (var i in headers) {
    console.log('setting request header', i, headers[i]);
    xhr.setRequestHeader(i, headers[i]);
  }
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
