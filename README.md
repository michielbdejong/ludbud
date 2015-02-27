# ludbud: Let User Data Be User Data

Ludbud is a fork of the on-the-wire parts of [remotestorage.js](https://github.com/remotestorage/remotestorage.js).
It consists of three mini-libraries, which each present the same interface.

# Usage

This will show three connect buttons (one for Dropbox, one for Google Drive, and one for remoteStorage),
and clicking one of them will invoke an OAuth dance:

````html
<!DOCTYPE html>
<html>
  <body>
    <button value="Connect to Dropbox!" onclick="Ludbud.oauth('dropbox');" />
    <button value="Connect to Google Drive!" onclick="Ludbud.oauth('googledrive');" />
    <input id="user-address" placeholder="user@provider.com" />
    <button value="Connect to your remoteStorage!" onclick="Ludbud.oauth('remotestorage', document.getElementById('user-address').value);" />
  </body>
  <script src="ludbud.js"></script>
  <script>
    Ludbud.setApiCredentials('dropbox', 'cybbbiarf4dkrce');
    Ludbud.setApiCredentials('google', '709507725318-3mt4ke1d4tvkc7ktbjvru3csif4nsk67.apps.googleusercontent.com');
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
