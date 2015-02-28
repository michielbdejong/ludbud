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
