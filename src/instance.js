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
