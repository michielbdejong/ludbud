remoteStorage = new RemoteStorage();

Ludbud = {
  oauth: function(provider, userAddress) {
    console.log('oauth', provider, userAddress);
    var wireClient, clientId;
    var className = {
      dropbox: 'Dropbox',
      googledrive: 'GoogleDrive',
      remotestorage: 'WireClient'
    };
    if (remoteStorage.apiKeys[provider]) {
      clientId = remoteStorage.apiKeys[provider].client_id;
    }
    wireClient = new RemoteStorage[className[provider]](remoteStorage, clientId);
    remoteStorage.access.claim('*', 'rw');
    remoteStorage.setBackend(provider);
    if (provider === 'remotestorage') {
      RemoteStorage.config.logging = true;
      remoteStorage.connect(userAddress);
    } else {
      wireClient.connect();
    }
  },
  setApiCredentials: function(provider, credentials) {
    var obj = (provider === 'googledrive' ?  { client_id: credentials } : { api_key: credentials });
    remoteStorage.setApiKeys(provider, obj);
  },
  fromWindowLocation: function() {
    console.log('from window location');
    return {
      isConnected: true,
      getInfo: function(path, callback) {
        remoteStorage.remote.get(path).then(function(data) {
          callback(null, data);
        }, function(err) {
          callback(err);
        });
      }
    };
  }
};
