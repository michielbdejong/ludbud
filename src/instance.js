ret.prototype.makeURL = function(dataPath, isFolder) {
  if (this.platform === 'owncloud') {
    if (isFolder) {
      return this.apiBaseURL
          + '/shares?path='
          + encodeURIComponent(dataPath)
    } else {
      return this.apiBaseURL
          + '/shares/'
          + encodeURIComponent(dataPath)
    }
  } else {
    return this.apiBaseURL + dataPath;
  }
};
ret.prototype.getInfo = function(dataPath, callback) {
  if (this.platform === 'hoodie') {
    this.getClient(function(err, client) {
      if (err) {
        callback(err);
      } else {
        client.store('item', dataPath).done(function(data) {
          callback(null, data);
        }).fail(function(err) {
          callback(err);
        });
      }
    });
  } else {
    request('HEAD', this.makeURL(dataPath), this.token, undefined, {}, function(err, data) {
      if (err) {
        callback(err);
      } else {
        callback(err, data.info);
      }
    });
  }
};
ret.prototype.getBody = function(dataPath, callback) {
  request('GET', this.makeURL(dataPath), this.token, undefined, {}, function(err, data) {
    if (err) {
      callback(err);
    } else {
      callback(err, data.body);
    }
  });
};
ret.prototype.getFolder = function(dataPath, callback) {
  requestJSON(this.makeURL(dataPath), this.token, function(err, data) {
    if (err) {
      callback(err);
    } else {
      callback(err, data.items);
    }
  });
};
ret.prototype.create = function(dataPath, content, contentType, callback) {
  request('PUT', this.makeURL(dataPath), this.token, content, {
     'Content-Type': contentType,
     'If-None-Match': '"*"'
  }, function(err, data) {
    callback(err, (data && data.info ? data.info.ETag : undefined));
  });
};
ret.prototype.update = function(dataPath, content, contentType, existingETag, callback) {
  request('PUT', this.makeURL(dataPath), this.token, content, {
     'Content-Type': contentType,
     'If-Match': existingETag
  }, function(err, data) {
    callback(err, (data && data.info ? data.info.ETag : undefined));
  });
};
ret.prototype.remove = function(dataPath, existingETag, callback) {
  request('DELETE', this.makeURL(dataPath), this.token, undefined, {
     'If-Match': existingETag
  }, callback);
};
