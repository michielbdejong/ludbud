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
ret.prototype.getClient = function(callback) {
  if (this.client) {
    cb(null, this.client);
  } else if (this.platform === 'hoodie') {
    this.client = new Hoodie('https://'+this.host);
    this.client.account.signIn(this.user, this.pass).done(function() {
      cb(null, this.client);
    }).fail(function(err) {
      cb(err);
    });
  } else {
    callback('don\'t know how to instantiate a client for platform '+this.platform);
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
    requestArrayBuffer('HEAD', this.makeURL(dataPath), this.token, undefined, {}, function(err, data) {
      if (err) {
        callback(err);
      } else {
        callback(err, data.info);
      }
    });
  }
};
ret.prototype.getDocument = function(dataPath, callback) {
  if (dataPath.substr(-1) === '/') {
    callback(ret.ERR_IS_FOLDER);
  } else {
    requestArrayBuffer('GET', this.makeURL(dataPath), this.token, undefined, {}, callback);
  }
};
ret.prototype.getFolder = function(dataPath, callback) {
  if (dataPath.substr(-1) === '/') {
    requestJSON(this.makeURL(dataPath), this.token, function(err, data) {
      if (err) {
        callback(err);
      } else {
        callback(err, data.items);
      }
    });
  } else {
    callback(ret.ERR_NOT_A_FOLDER);
  }
};
ret.prototype.create = function(dataPath, content, contentType, callback) {
  requestArrayBuffer('PUT', this.makeURL(dataPath), this.token, content, {
     'Content-Type': contentType,
     'If-None-Match': '"*"'
  }, function(err, data) {
    callback(err, (data && data.info ? data.info.ETag : undefined));
  });
};
ret.prototype.update = function(dataPath, content, contentType, existingETag, callback) {
  if (!existingETag) {
    return this.create(dataPath, content, contentType, callback);
  }
  requestArrayBuffer('PUT', this.makeURL(dataPath), this.token, content, {
     'Content-Type': contentType,
     'If-Match': existingETag
  }, function(err, data) {
    callback(err, (data && data.info ? data.info.ETag : undefined));
  });
};
ret.prototype.remove = function(dataPath, existingETag, callback) {
  requestArrayBuffer('DELETE', this.makeURL(dataPath), this.token, undefined, {
     'If-Match': existingETag
  }, callback);
};
