ret.prototype.makeURL = function(dataPath) {
  return this.credentials.apiBaseURL + dataPath;
};
ret.prototype.getInfo = function(dataPath, callback) {
  request('HEAD', this.makeURL(dataPath), this.credentials.token, undefined, function(err, data) {
    if (err) {
      callback(err);
    } else {
      callback(err, data.info);
    }
  });
};
