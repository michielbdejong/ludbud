function Instance(token, platform) {
  this.isConnected = true;
  this.token = token;
  this.platform = platform;
}
Instance.prototype.getInfo = function(path, callback) {
  callback('not implemented yet!');
};
