function Instance(token, platform, scopes) {
  this.isConnected = true;
  this.token = token;
  this.platform = platform;
  this.scopes = scopes;
}
Instance.prototype.getInfo = function(path, callback) {
  callback('not implemented yet!');
};
