# WARNING: Under construction

## ludbud: Let User Data Be User Data

Let's respect user data on the web, and not consider it advertising data. Let the user's data be owned by the user, stored in a location they choose.

Ludbud is a client-side JavaScript library for accessing per-user data on the user's own data storage, without prescribing to the user where they store their data. This can be the user's ownCloud, their Hoodie, their remoteStorage, their Dropbox account, or their Google Drive account.

So far, remoteStorage is [mostly](https://github.com/michielbdejong/ludbud/labels/remoteStorage) implemented, and I'm working on Hoodie.

The API still changes on a daily basis.

OwnCloud support is blocked by [ownCloud enabling CORS headers on their OCS Share API](https://github.com/owncloud/core/issues/10415#issuecomment-76533629).

Dropbox and Google Drive coming soon.

If you are looking for a more mature and complete client-side implementation of the [remoteStorage protocol](http://tools.ietf.org/html/draft-dejong-remotestorage-04), you should also check out [remotestorage.js](https://github.com/remotestorage/remotestorage.js), which is a much bigger library
that also gives you features like local caching, asynchronous synchronization, and a UI widget, on top of what is basically an identical wire client.

# Build

Run `./build.sh` to concatenate the files from `src/` into `ludbud.js`.

# Usage

This is from `example.html`, which shows how to use Mozilla's localForage to store user data credentials from OAuth:

````js
function getUserDataCredentials(callback) {
  var harvest = Ludbud.fromWindowLocation();
  if (harvest) {
    console.log('setting harvest into localforage, then reloading page', harvest);
    localforage.setItem('userDataCredentials', harvest, function(err) {
      Ludbud.restoreWindowLocation();
      //now the page will be reloaded, after which harvest will be undefined
    });
  } else {
    localforage.getItem('userDataCredentials', callback);
  }
}
function connect(platform, hostOrUserAddress, user, pass) {
  console.log('connect', platform, hostOrUserAddress, user, pass);
  if (platform === 'owncloud') {
    //ownCloud uses direct credentials:
    var userDataCredentials = Ludbud.createCredentials(platform, hostOrUserAddress, user, pass);
    localforage.setItem('userDataCredentials', userDataCredentials, function(err) {
      go(err, userDataCredentials);
    });
  } else {
    //remoteStorage, Dropbox, and Google Drive use OAuth:
    Ludbud.oauth(platform, hostOrUserAddress);
  }
}
function go(err, userDataCredentials) {
  if (err) {
    console.log('error getting user data credentials', err);
  } else if (userDataCredentials) {
    ludbud = new Ludbud(userDataCredentials);
    console.log('now we can use the ludbud object to access the user\'s data');
  } else {
    console.log('No user data credentials yet. Please click one of the buttons');
  }
}
function reset() {
  localforage.clear(function() {
    window.location = window.location.href;
  });
}

//... on page load:
var ludbud;
Ludbud.setPlatformCredentials('dropbox', 'cybbbiarf4dkrce');
Ludbud.setPlatformCredentials('googledrive', '709507725318-3mt4ke1d4tvkc7ktbjvru3csif4nsk67.apps.googleusercontent.com');
getUserDataCredentials(go);
````

To access the data:
````js
ludbud.getInfo('/path/to/item', function(err, info) {
  //err might be Ludbud.ERR_TIMEOUT, Ludbud.ERR_ACCESS_DENIED, or Ludbud.ERR_NOT_FOUND
  //if not, info is an object containing one or more of:
  // * Content-Type (string)
  // * Content-Length (number, measured in bytes on the wire)
  // * ETag (string version)
  // * isFolder (boolean)
});

ludbud.getBody('/path/to/item', function(err, body) {
  //err might be Ludbud.ERR_TIMEOUT, Ludbud.ERR_ACCESS_DENIED, Ludbud.ERR_NOT_FOUND, or Ludbud.ERR_IS_FOLDER
  //if not, body is an ArrayBuffer
});

ludbud.getFolder('/path/to/folder/', function(err, listing) {
  //err might be Ludbud.ERR_TIMEOUT, Ludbud.ERR_ACCESS_DENIED, Ludbud.ERR_NOT_FOUND, or Ludbud.ERR_NOT_A_FOLDER
  //if not, listing will be an object where keys are item names, and values are objects containing one or more of:
  // * Content-Type (string)
  // * Content-Length (number, measured in bytes on the wire)
  // * isFolder (boolean)
});
````

To change the data
````js
ludbud.create('/path/to/item', content, contentType, function(err) {
  //err might be Ludbud.ERR_TIMEOUT, Ludbud.ERR_ACCESS_DENIED, or Ludbud.ERR_IS_FOLDER
});
ludbud.update('/path/to/item', newContent, newContentType, existingETag, function(err) {
  //err might be Ludbud.ERR_TIMEOUT, Ludbud.ERR_ACCESS_DENIED, Ludbud.ERR_NOT_FOUND, or Ludbud.ERR_IS_FOLDER
});
ludbud.delete('/path/to/item', existingETag, function(err) {
  //err might be Ludbud.ERR_TIMEOUT, Ludbud.ERR_ACCESS_DENIED, Ludbud.ERR_NOT_FOUND, or Ludbud.ERR_IS_FOLDER
});
````

Helper function for the OAuth dance:
````js
Ludbud.setPlatformCredentials(platform, keyOrId);
Ludbud.createCredentials(provider, host, user, pass); -> creates credentials, use this one for the ownCloud platform
Ludbud.oauth(provider); -> sets window.location to initiate an OAuth dance, use this for remoteStorage, Dropbox, and Google Drive platforms
Ludbud.fromWindowLocation(); -> harvests window.location and returns the user data credentials
ludbud.restoreWindowLocation(); -> cleans up the URL fragment after the OAuth dance (triggers a page refresh)
