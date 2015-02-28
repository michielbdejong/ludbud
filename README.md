# WARNING: Under construction

## ludbud: Let User Data Be User Data

Ludbud is a client-side JavaScript library for accessing per-user data on the user's remoteStorage, Dropbox, Google Drive, Hoodie, etcetera.
Its aim is to be a second independent (and much more light-weight) client-side implementation of the [remoteStorage protocol](http://tools.ietf.org/html/draft-dejong-remotestorage-04), as well as a client for other per-user data stores which offer an API which is accessible from the browser (i.e. support OAuth 2 implicit grant flow and provide CORS headers). Currently it supports only remoteStorage, and only partially. Support for Dropbox, GoogleDrive, Hoodie, and ownCloud is planned.

Size (minified, gzipped): 1.2K

# Build

Run `./build.sh` to concatenate the files from `src/` into `ludbud.js`.

# Usage

This will show three connect buttons (one for Dropbox, one for Google Drive, and one for remoteStorage),
and clicking one of them will invoke an OAuth dance:

````html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
  </head>
  <body>
    <button onclick="Ludbud.oauth('dropbox');">Connect to Dropbox!</button>
    <button onclick="Ludbud.oauth('googledrive');">Connect to Google Drive!</button>
    <button onclick="Ludbud.oauth('remotestorage', document.getElementById('user-address').value);">Connect to your remoteStorage:</button>
    <input id="user-address" placeholder="user@provider.com" />
  </body>
  <script src="./ludbud.js"></script>
  <script>
    Ludbud.setApiCredentials('dropbox', 'cybbbiarf4dkrce');
    Ludbud.setApiCredentials('googledrive', '709507725318-3mt4ke1d4tvkc7ktbjvru3csif4nsk67.apps.googleusercontent.com');
    var ludbud = Ludbud.fromWindowLocation();
    if (ludbud.isConnected) {      
      ludbud.getInfo('/', function(err, info) {
        console.log(err, info);
      });
    } else {
      console.log('Please click one of the buttons');
    }
  </script>
</html>
````

To access the data:
````js
ludbud.getInfo('/path/to/item', function(err, info) {
  //err might be Ludbud.ERR_TIMEOUT, Ludbud.ERR_ACCESS_DENIED, or Ludbud.ERR_NOT_FOUND
  //if not, info is an object containing one or more of:
  // * Content-Type (string)
  // * Content-Length (number, measured in bytes on the wire)
  // * isFolder (boolean)
});

ludbud.getBody('/path/to/item', function(err, body) {
  //err might be Ludbud.ERR_TIMEOUT, Ludbud.ERR_ACCESS_DENIED, Ludbud.ERR_NOT_FOUND, or Ludbud.ERR_IS_FOLDER
  //if not, body is an ArrayBuffer (client-side), or a Buffer (server-side)
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
ludbud.updateContent('/path/to/item', newContent, function(err) {
  //err might be Ludbud.ERR_TIMEOUT, Ludbud.ERR_ACCESS_DENIED, Ludbud.ERR_NOT_FOUND, or Ludbud.ERR_IS_FOLDER
});
ludbud.updateContentType('/path/to/item', newContentType, function(err) {
  //err might be Ludbud.ERR_TIMEOUT, Ludbud.ERR_ACCESS_DENIED, Ludbud.ERR_NOT_FOUND, or Ludbud.ERR_IS_FOLDER
});
ludbud.delete('/path/to/item', function(err) {
  //err might be Ludbud.ERR_TIMEOUT, Ludbud.ERR_ACCESS_DENIED, Ludbud.ERR_NOT_FOUND, or Ludbud.ERR_IS_FOLDER
});
````

Helper functions:
````js
Ludbud.oauth(provider); -> sets window.location to initiate an OAuth dance
Ludbud.fromWindowLocation(); -> harvests window.location and returns an instantiated ludbud object
ludbud.isConnected -> boolean
````
