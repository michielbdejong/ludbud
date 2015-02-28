# WARNING: Under construction

## ludbud: Let User Data Be User Data

Ludbud is a client-side JavaScript library for accessing per-user data on the user's remoteStorage, Dropbox, Google Drive, Hoodie, etcetera.
Its aim is to be a second independent (and much more light-weight) client-side implementation of the [remoteStorage protocol](http://tools.ietf.org/html/draft-dejong-remotestorage-04), as well as a client for other per-user data stores which offer an API which is accessible from the browser (i.e. support OAuth 2 implicit grant flow and provide CORS headers). Currently it supports only remoteStorage, and only partially. Support for Dropbox, GoogleDrive, Hoodie, and ownCloud is planned.

Size (minified, gzipped): 1.2K

# Build

Run `./build.sh` to concatenate the files from `src/` into `ludbud.js`.

# Usage

This is from `example.html`, which shows how to use Mozilla's localForage to store user data credentials from OAuth:

````js
var ludbud;
Ludbud.setApiCredentials('dropbox', 'cybbbiarf4dkrce');
Ludbud.setApiCredentials('googledrive', '709507725318-3mt4ke1d4tvkc7ktbjvru3csif4nsk67.apps.googleusercontent.com');
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
getUserDataCredentials(function(err, userDataCredentials) {
  if (err) {
    console.log('error getting user data credentials', err);
  } else if (userDataCredentials) {
    ludbud = new Ludbud(userDataCredentials);
    console.log('now we can use the ludbud object to access the user\'s data');
  } else {
    console.log('No user data credentials yet. Please click one of the buttons');
  }
});
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

Helper functions:
````js
Ludbud.oauth(provider); -> sets window.location to initiate an OAuth dance
Ludbud.fromWindowLocation(); -> harvests window.location and returns an instantiated ludbud object
ludbud.isConnected -> boolean
