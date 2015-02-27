/** FILE: src/wireclient.js **/
(function (global) {
  var RS = RemoteStorage;

  /**
   * Class: RemoteStorage.WireClient
   *
   * WireClient Interface
   * --------------------
   *
   * This file exposes a get/put/delete interface on top of XMLHttpRequest.
   * It requires to be configured with parameters about the remotestorage server to
   * connect to.
   * Each instance of WireClient is always associated with a single remotestorage
   * server and access token.
   *
   * Usually the WireClient instance can be accessed via `remoteStorage.remote`.
   *
   * This is the get/put/delete interface:
   *
   *   - #get() takes a path and optionally a ifNoneMatch option carrying a version
   *     string to check. It returns a promise that will be fulfilled with the HTTP
   *     response status, the response body, the MIME type as returned in the
   *     'Content-Type' header and the current revision, as returned in the 'ETag'
   *     header.
   *   - #put() takes a path, the request body and a content type string. It also
   *     accepts the ifMatch and ifNoneMatch options, that map to the If-Match and
   *     If-None-Match headers respectively. See the remotestorage-01 specification
   *     for details on handling these headers. It returns a promise, fulfilled with
   *     the same values as the one for #get().
   *   - #delete() takes a path and the ifMatch option as well. It returns a promise
   *     fulfilled with the same values as the one for #get().
   *
   * In addition to this, the WireClient has some compatibility features to work with
   * remotestorage 2012.04 compatible storages. For example it will cache revisions
   * from folder listings in-memory and return them accordingly as the "revision"
   * parameter in response to #get() requests. Similarly it will return 404 when it
   * receives an empty folder listing, to mimic remotestorage-01 behavior. Note
   * that it is not always possible to know the revision beforehand, hence it may
   * be undefined at times (especially for caching-roots).
   */

  var hasLocalStorage;
  var SETTINGS_KEY = 'remotestorage:wireclient';

  var API_2012 = 1, API_00 = 2, API_01 = 3, API_02 = 4, API_HEAD = 5;

  var STORAGE_APIS = {
    'draft-dejong-remotestorage-00': API_00,
    'draft-dejong-remotestorage-01': API_01,
    'draft-dejong-remotestorage-02': API_02,
    'https://www.w3.org/community/rww/wiki/read-write-web-00#simple': API_2012
  };

  var isArrayBufferView;

  if (typeof(ArrayBufferView) === 'function') {
    isArrayBufferView = function (object) { return object && (object instanceof ArrayBufferView); };
  } else {
    var arrayBufferViews = [
      Int8Array, Uint8Array, Int16Array, Uint16Array,
      Int32Array, Uint32Array, Float32Array, Float64Array
    ];
    isArrayBufferView = function (object) {
      for (var i=0;i<8;i++) {
        if (object instanceof arrayBufferViews[i]) {
          return true;
        }
      }
      return false;
    };
  }

  var isFolder = RemoteStorage.util.isFolder;
  var cleanPath = RemoteStorage.util.cleanPath;

  function addQuotes(str) {
    if (typeof(str) !== 'string') {
      return str;
    }
    if (str === '*') {
      return '*';
    }

    return '"' + str + '"';
  }

  function stripQuotes(str) {
    if (typeof(str) !== 'string') {
      return str;
    }

    return str.replace(/^["']|["']$/g, '');
  }

  function readBinaryData(content, mimeType, callback) {
    var blob;
    global.BlobBuilder = global.BlobBuilder || global.WebKitBlobBuilder;
    if (typeof global.BlobBuilder !== 'undefined') {
      var bb = new global.BlobBuilder();
      bb.append(content);
      blob = bb.getBlob(mimeType);
    } else {
      blob = new Blob([content], { type: mimeType });
    }

    var reader = new FileReader();
    if (typeof reader.addEventListener === 'function') {
      reader.addEventListener('loadend', function () {
        callback(reader.result); // reader.result contains the contents of blob as a typed array
      });
    } else {
      reader.onloadend = function() {
        callback(reader.result); // reader.result contains the contents of blob as a typed array
      }
    }
    reader.readAsArrayBuffer(blob);
  }

  function getTextFromArrayBuffer(arrayBuffer, encoding) {
    var pending = Promise.defer();
    if (typeof Blob === 'undefined') {
      var buffer = new Buffer(new Uint8Array(arrayBuffer));
      pending.resolve(buffer.toString(encoding));
    } else {
      var blob;
      global.BlobBuilder = global.BlobBuilder || global.WebKitBlobBuilder;
      if (typeof global.BlobBuilder !== 'undefined') {
        var bb = new global.BlobBuilder();
        bb.append(arrayBuffer);
        blob = bb.getBlob();
      } else {
        blob = new Blob([arrayBuffer]);
      }

      var fileReader = new FileReader();
      if (typeof fileReader.addEventListener === 'function') {
        fileReader.addEventListener('loadend', function (evt) {
          pending.resolve(evt.target.result);
        });
      } else {
        fileReader.onloadend = function(evt) {
          pending.resolve(evt.target.result);
        }
      }
      fileReader.readAsText(blob, encoding);
    }
    return pending.promise;
  }

  function determineCharset(mimeType) {
    var charset = 'UTF-8';
    var charsetMatch;

    if (mimeType) {
      charsetMatch = mimeType.match(/charset=(.+)$/);
      if (charsetMatch) {
        charset = charsetMatch[1];
      }
    }
    return charset;
  }

  function isFolderDescription(body) {
    return ((body['@context'] === 'http://remotestorage.io/spec/folder-description')
             && (typeof(body['items']) === 'object'));
  }

  function isSuccessStatus(status) {
    return [201, 204, 304].indexOf(status) >= 0;
  }

  function isErrorStatus(status) {
    return [401, 403, 404, 412].indexOf(status) >= 0;
  }

  var onErrorCb;

  /**
   * Class : RemoteStorage.WireClient
   **/
  RS.WireClient = function (rs) {
    this.connected = false;

    /**
     * Event: change
     *   never fired for some reason
     *
     * Event: connected
     *   fired when the wireclient connect method realizes that it is
     *   in posession of a token and a href
     **/
    RS.eventHandling(this, 'change', 'connected', 'wire-busy', 'wire-done', 'not-connected');

    onErrorCb = function (error){
      if (error instanceof RemoteStorage.Unauthorized) {
        this.configure({token: null});
      }
    }.bind(this);
    rs.on('error', onErrorCb);
    if (hasLocalStorage) {
      var settings;
      try { settings = JSON.parse(localStorage[SETTINGS_KEY]); } catch(e) {}
      if (settings) {
        setTimeout(function () {
          this.configure(settings);
        }.bind(this), 0);
      }
    }

    this._revisionCache = {};

    if (this.connected) {
      setTimeout(this._emit.bind(this), 0, 'connected');
    }
  };

  RS.WireClient.REQUEST_TIMEOUT = 30000;

  RS.WireClient.prototype = {
    /**
     * Property: token
     *
     * Holds the bearer token of this WireClient, as obtained in the OAuth dance
     *
     * Example:
     *   (start code)
     *
     *   remoteStorage.remote.token
     *   // -> 'DEADBEEF01=='
     */

    /**
     * Property: href
     *
     * Holds the server's base URL, as obtained in the Webfinger discovery
     *
     * Example:
     *   (start code)
     *
     *   remoteStorage.remote.href
     *   // -> 'https://storage.example.com/users/jblogg/'
     */

    /**
     * Property: storageApi
     *
     * Holds the spec version the server claims to be compatible with
     *
     * Example:
     *   (start code)
     *
     *   remoteStorage.remote.storageApi
     *   // -> 'draft-dejong-remotestorage-01'
     */

    _request: function (method, uri, token, headers, body, getEtag, fakeRevision) {
      if ((method === 'PUT' || method === 'DELETE') && uri[uri.length - 1] === '/') {
        return Promise.reject('Don\'t ' + method + ' on directories!');
      }

      var revision;
      var reqType;
      var self = this;

      if (token !== RemoteStorage.Authorize.IMPLIED_FAKE_TOKEN) {
        headers['Authorization'] = 'Bearer ' + token;
      }

      this._emit('wire-busy', {
        method: method,
        isFolder: isFolder(uri)
      });

      return RS.WireClient.request(method, uri, {
        body: body,
        headers: headers,
        responseType: 'arraybuffer'
      }).then(function (response) {
        self._emit('wire-done', {
          method: method,
          isFolder: isFolder(uri),
          success: true
        });
        self.online = true;
        if (isErrorStatus(response.status)) {
          RemoteStorage.log('[WireClient] Error response status', response.status);
          if (getEtag) {
            revision = stripQuotes(response.getResponseHeader('ETag'));
          } else {
            revision = undefined;
          }
          return Promise.resolve({statusCode: response.status, revision: revision});
        } else if (isSuccessStatus(response.status) ||
                   (response.status === 200 && method !== 'GET')) {
          revision = stripQuotes(response.getResponseHeader('ETag'));
          RemoteStorage.log('[WireClient] Successful request', revision);
          return Promise.resolve({statusCode: response.status, revision: revision});
        } else {
          var mimeType = response.getResponseHeader('Content-Type');
          var body;
          if (getEtag) {
            revision = stripQuotes(response.getResponseHeader('ETag'));
          } else {
            revision = response.status === 200 ? fakeRevision : undefined;
          }

          var charset = determineCharset(mimeType);

          if ((!mimeType) || charset === 'binary') {
            RemoteStorage.log('[WireClient] Successful request with unknown or binary mime-type', revision);
            return Promise.resolve({statusCode: response.status, body: response.response, contentType: mimeType, revision: revision});
          } else {
            return getTextFromArrayBuffer(response.response, charset).then(function (body) {
              RemoteStorage.log('[WireClient] Successful request', revision);
              return Promise.resolve({statusCode: response.status, body: body, contentType: mimeType, revision: revision});
            });
          }
        }
      }, function (error) {
        self._emit('wire-done', {
          method: method,
          isFolder: isFolder(uri),
          success: false
        });
        return Promise.reject(error);
      });
    },

    /**
     *
     * Method: configure
     *
     * Sets the userAddress, href, storageApi, token, and properties of a
     * remote store. Also sets connected and online to true and emits the
     * 'connected' event, if both token and href are present.
     *
     * Parameters:
     *   settings - An object that may contain userAddress (string or null),
     *              href (string or null), storageApi (string or null), token (string
     *              or null), and/or properties (the JSON-parsed properties object
     *              from the user's WebFinger record, see section 10 of
     *              http://tools.ietf.org/html/draft-dejong-remotestorage-03
     *              or null).
     *              Fields that are not included (i.e. `undefined`), stay at
     *              their current value. To set a field, include that field
     *              with a `string` value. To reset a field, for instance when
     *              the user disconnected their storage, or you found that the
     *              token you have has expired, simply set that field to `null`.
     */
    configure: function (settings) {
      if (typeof settings !== 'object') {
        throw new Error('WireClient configure settings parameter should be an object');
      }
      if (typeof settings.userAddress !== 'undefined') {
        this.userAddress = settings.userAddress;
      }
      if (typeof settings.href !== 'undefined') {
        this.href = settings.href;
      }
      if (typeof settings.storageApi !== 'undefined') {
        this.storageApi = settings.storageApi;
      }
      if (typeof settings.token !== 'undefined') {
        this.token = settings.token;
      }
      if (typeof settings.properties !== 'undefined') {
        this.properties = settings.properties;
      }

      if (typeof this.storageApi !== 'undefined') {
        this._storageApi = STORAGE_APIS[this.storageApi] || API_HEAD;
        this.supportsRevs = this._storageApi >= API_00;
      }
      if (this.href && this.token) {
        this.connected = true;
        this.online = true;
        this._emit('connected');
      } else {
        this.connected = false;
      }
      if (hasLocalStorage) {
        localStorage[SETTINGS_KEY] = JSON.stringify({
          userAddress: this.userAddress,
          href: this.href,
          storageApi: this.storageApi,
          token: this.token,
          properties: this.properties
        });
      }
    },

    stopWaitingForToken: function () {
      if (!this.connected) {
        this._emit('not-connected');
      }
    },

    get: function (path, options) {
      var self = this;
      if (!this.connected) {
        return Promise.reject('not connected (path: ' + path + ')');
      }
      if (!options) { options = {}; }
      var headers = {};
      if (this.supportsRevs) {
        if (options.ifNoneMatch) {
          headers['If-None-Match'] = addQuotes(options.ifNoneMatch);
        }
      } else if (options.ifNoneMatch) {
        var oldRev = this._revisionCache[path];
      }


      return this._request('GET', this.href + cleanPath(path), this.token, headers,
                            undefined, this.supportsRevs, this._revisionCache[path])
      .then(function (r) {
        if (!isFolder(path)) {
          return Promise.resolve(r);
        }
        var itemsMap = {};
        if (typeof(r.body) !== 'undefined') {
          try {
            r.body = JSON.parse(r.body);
          } catch (e) {
            return Promise.reject('Folder description at ' + self.href + cleanPath(path) + ' is not JSON');
          }
        }

        if (r.statusCode === 200 && typeof(r.body) === 'object') {
        // New folder listing received
          if (Object.keys(r.body).length === 0) {
          // Empty folder listing of any spec
            r.statusCode = 404;
          } else if (isFolderDescription(r.body)) {
          // >= 02 spec
            for (var item in r.body.items) {
              self._revisionCache[path + item] = r.body.items[item].ETag;
            }
            itemsMap = r.body.items;
          } else {
          // < 02 spec
            Object.keys(r.body).forEach(function (key){
              self._revisionCache[path + key] = r.body[key];
              itemsMap[key] = {'ETag': r.body[key]};
            });
          }
          r.body = itemsMap;
          return Promise.resolve(r);
        } else {
          return Promise.resolve(r);
        }
      });
    },

    put: function (path, body, contentType, options) {
      if (!this.connected) {
        return Promise.reject('not connected (path: ' + path + ')');
      }
      if (!options) { options = {}; }
      if ((!contentType.match(/charset=/)) && (body instanceof ArrayBuffer || isArrayBufferView(body))) {
        contentType +=  '; charset=binary';
      }
      var headers = { 'Content-Type': contentType };
      if (this.supportsRevs) {
        if (options.ifMatch) {
          headers['If-Match'] = addQuotes(options.ifMatch);
        }
        if (options.ifNoneMatch) {
          headers['If-None-Match'] = addQuotes(options.ifNoneMatch);
        }
      }
      return this._request('PUT', this.href + cleanPath(path), this.token,
                     headers, body, this.supportsRevs);
    },

    'delete': function (path, options) {
      if (!this.connected) {
        throw new Error('not connected (path: ' + path + ')');
      }
      if (!options) { options = {}; }
      var headers = {};
      if (this.supportsRevs) {
        if (options.ifMatch) {
          headers['If-Match'] = addQuotes(options.ifMatch);
        }
      }
      return this._request('DELETE', this.href + cleanPath(path), this.token,
                     headers,
                     undefined, this.supportsRevs);
    }
  };

  // Shared cleanPath used by Dropbox
  RS.WireClient.cleanPath = cleanPath;

  // Shared isArrayBufferView used by WireClient and Dropbox
  RS.WireClient.isArrayBufferView = isArrayBufferView;

  RS.WireClient.readBinaryData = readBinaryData;

  // Shared request function used by WireClient, GoogleDrive and Dropbox.
  RS.WireClient.request = function (method, url, options) {
    var pending = Promise.defer();
    RemoteStorage.log('[WireClient]', method, url);

    var timedOut = false;

    var timer = setTimeout(function () {
      timedOut = true;
      pending.reject('timeout');
    }, RS.WireClient.REQUEST_TIMEOUT);

    var xhr = new XMLHttpRequest();
    xhr.open(method, url, true);

    if (options.responseType) {
      xhr.responseType = options.responseType;
    }

    if (options.headers) {
      for (var key in options.headers) {
        xhr.setRequestHeader(key, options.headers[key]);
      }
    }

    xhr.onload = function () {
      if (timedOut) { return; }
      clearTimeout(timer);
      pending.resolve(xhr);
    };

    xhr.onerror = function (error) {
      if (timedOut) { return; }
      clearTimeout(timer);
      pending.reject(error);
    };

    var body = options.body;

    if (typeof(body) === 'object' && !isArrayBufferView(body) && body instanceof ArrayBuffer) {
      body = new Uint8Array(body);
    }
    xhr.send(body);
    return pending.promise;
  };

  Object.defineProperty(RemoteStorage.WireClient.prototype, 'storageType', {
    get: function () {
      if (this.storageApi) {
        var spec = this.storageApi.match(/draft-dejong-(remotestorage-\d\d)/);
        return spec ? spec[1] : '2012.04';
      }
    }
  });


  RS.WireClient._rs_init = function (remoteStorage) {
    hasLocalStorage = remoteStorage.localStorageAvailable();
    remoteStorage.remote = new RS.WireClient(remoteStorage);
    this.online = true;
  };

  RS.WireClient._rs_supported = function () {
    return !! global.XMLHttpRequest;
  };

  RS.WireClient._rs_cleanup = function (remoteStorage){
    if (hasLocalStorage){
      delete localStorage[SETTINGS_KEY];
    }
    remoteStorage.removeEventListener('error', onErrorCb);
  };

})(typeof(window) !== 'undefined' ? window : global);


/** FILE: src/discover.js **/
(function (global) {

  // feature detection flags
  var haveXMLHttpRequest, hasLocalStorage;
  // used to store settings in localStorage
  var SETTINGS_KEY = 'remotestorage:discover';
  // cache loaded from localStorage
  var cachedInfo = {};

  /**
   * Class: RemoteStorage.Discover
   *
   * This function deals with the Webfinger lookup, discovering a connecting
   * user's storage details.
   *
   * The discovery timeout can be configured via
   * `RemoteStorage.config.discoveryTimeout` (in ms).
   *
   * Arguments:
   *
   *   userAddress - user@host
   *
   * Returns:
   *
   * A promise for an object with the following properties.
   *
   *   href - Storage base URL,
   *   storageType - Storage type,
   *   authUrl - OAuth URL,
   *   properties - Webfinger link properties
   **/

  RemoteStorage.Discover = function (userAddress) {
    if (userAddress in cachedInfo) {
      return Promise.resolve(cachedInfo[userAddress]);
    }

    var webFinger = new WebFinger({
      tls_only: false,
      uri_fallback: true,
      request_timeout: 5000
    });

    var pending = Promise.defer();

    webFinger.lookup(userAddress, function (err, response) {
      if (err) {
        return pending.reject(err.message);
      } else if ((typeof response.idx.links.remotestorage !== 'object') ||
                 (typeof response.idx.links.remotestorage.length !== 'number') ||
                 (response.idx.links.remotestorage.length <= 0)) {
        RemoteStorage.log("[Discover] WebFinger record for " + userAddress + " does not have remotestorage defined in the links section ", JSON.stringify(response.json));
        return pending.reject("WebFinger record for " + userAddress + " does not have remotestorage defined in the links section.");
      }

      var rs = response.idx.links.remotestorage[0];
      var authURL = rs.properties['http://tools.ietf.org/html/rfc6749#section-4.2'] ||
                    rs.properties['auth-endpoint'];
      var storageType = rs.properties['http://remotestorage.io/spec/version'] ||
                        rs.type;

      // cache fetched data
      cachedInfo[userAddress] = { href: rs.href, storageType: storageType, authURL: authURL, properties: rs.properties };

      if (hasLocalStorage) {
        localStorage[SETTINGS_KEY] = JSON.stringify({ cache: cachedInfo });
      }

      return pending.resolve(cachedInfo[userAddress]);
    });

    return pending.promise;
  };

  RemoteStorage.Discover._rs_init = function (remoteStorage) {
    hasLocalStorage = remoteStorage.localStorageAvailable();
    if (hasLocalStorage) {
      var settings;
      try { settings = JSON.parse(localStorage[SETTINGS_KEY]); } catch(e) {}
      if (settings) {
        cachedInfo = settings.cache;
      }
    }
  };

  RemoteStorage.Discover._rs_supported = function () {
    haveXMLHttpRequest = !! global.XMLHttpRequest;
    return haveXMLHttpRequest;
  };

  RemoteStorage.Discover._rs_cleanup = function () {
    if (hasLocalStorage) {
      delete localStorage[SETTINGS_KEY];
    }
  };

})(typeof(window) !== 'undefined' ? window : global);


/** FILE: node_modules/webfinger.js/src/webfinger.js **/
/*!
 * webfinger.js
 *   version 2.1.4
 *   http://github.com/silverbucket/webfinger.js
 *
 * Developed and Maintained by:
 *   Nick Jennings <nick@silverbucket.net> 2012 - 2014
 *
 * webfinger.js is released under the AGPL (see LICENSE).
 *
 * You don't have to do anything special to choose one license or the other and you don't
 * have to notify anyone which license you are using.
 * Please see the corresponding license file for details of these licenses.
 * You are free to use, modify and distribute this software, but all copyright
 * information must remain.
 *
 */

if (typeof XMLHttpRequest === 'undefined') {
  XMLHttpRequest = require('xmlhttprequest').XMLHttpRequest;
}

(function (undefined) {

  // URI to property name map
  var LINK_URI_MAPS = {
    'http://webfist.org/spec/rel': 'webfist',
    'http://webfinger.net/rel/avatar': 'avatar',
    'remotestorage': 'remotestorage',
    'remoteStorage': 'remotestorage',
    'http://www.packetizer.com/rel/share': 'share',
    'http://webfinger.net/rel/profile-page': 'profile',
    'me': 'profile',
    'vcard': 'vcard',
    'blog': 'blog',
    'http://packetizer.com/rel/blog': 'blog',
    'http://schemas.google.com/g/2010#updates-from': 'updates',
    'https://camlistore.org/rel/server': 'camilstore'
  };

  var LINK_PROPERTIES = {
    'avatar': [],
    'remotestorage': [],
    'blog': [],
    'vcard': [],
    'updates': [],
    'share': [],
    'profile': [],
    'webfist': [],
    'camilstore': []
  };

  // list of endpoints to try, fallback from beginning to end.
  var URIS = ['webfinger', 'host-meta', 'host-meta.json'];

  function _err(obj) {
    obj.toString = function () {
      return this.message;
    };
    return obj;
  }

  /**
   * Function: WebFinger
   *
   * WebFinger constructor
   *
   * Returns:
   *
   *   return WebFinger object
   */
  function WebFinger(config) {
    if (typeof config !== 'object') {
      config = {};
    }

    this.config = {
      tls_only:         (typeof config.tls_only !== 'undefined') ? config.tls_only : true,
      webfist_fallback: (typeof config.webfist_fallback !== 'undefined') ? config.webfist_fallback : false,
      uri_fallback:     (typeof config.uri_fallback !== 'undefined') ? config.uri_fallback : false,
      request_timeout:  (typeof config.request_timeout !== 'undefined') ? config.request_timeout : 10000
    };
  }

  // make an http request and look for JRD response, fails if request fails
  // or response not json.
  WebFinger.prototype._fetchJRD = function (url, cb) {
    var self = this;
    var xhr = new XMLHttpRequest();

    xhr.onreadystatechange = function () {
      if (xhr.readyState === 4) {
        if (xhr.status === 200) {
          if (self._isValidJSON(xhr.responseText)) {
            cb(null, xhr.responseText);
          } else {
            cb(_err({
              message: 'invalid json',
              url: url,
              status: xhr.status
            }));
          }
        } else if (xhr.status === 404) {
          cb(_err({
            message: 'endpoint unreachable',
            url: url,
            status: xhr.status
          }));
        } else {
          cb(_err({
            message: 'error during request',
            url: url,
            status: xhr.status
          }));
        }
      }
    };

    xhr.open('GET', url, true);
    xhr.setRequestHeader('Accept', 'application/jrd+json, application/json');
    xhr.send();
  };

  WebFinger.prototype._isValidJSON = function (str) {
    try {
      JSON.parse(str);
    } catch (e) {
      return false;
    }
    return true;
  };

  WebFinger.prototype._isLocalhost = function (host) {
    var local = /^localhost(\.localdomain)?(\:[0-9]+)?$/;
    return local.test(host);
  };

  // processes JRD object as if it's a webfinger response object
  // looks for known properties and adds them to profile datat struct.
  WebFinger.prototype._processJRD = function (JRD, cb) {
    var self = this;
    var parsedJRD = JSON.parse(JRD);
    if ((typeof parsedJRD !== 'object') ||
        (typeof parsedJRD.links !== 'object')) {
      if (typeof parsedJRD.error !== 'undefined') {
        cb(_err({ message: parsedJRD.error }));
      } else {
        cb(_err({ message: 'unknown response from server' }));
      }
      return false;
    }

    var links = parsedJRD.links;
    var result = {  // webfinger JRD - object, json, and our own indexing
      object: parsedJRD,
      json: JRD,
      idx: {}
    };

    result.idx.properties = {
      'name': undefined
    };
    result.idx.links = JSON.parse(JSON.stringify(LINK_PROPERTIES));

    // process links
    links.map(function (link, i) {
      if (LINK_URI_MAPS.hasOwnProperty(link.rel)) {
        if (result.idx.links[LINK_URI_MAPS[link.rel]]) {
          var entry = {};
          Object.keys(link).map(function (item, n) {
            entry[item] = link[item];
          });
          result.idx.links[LINK_URI_MAPS[link.rel]].push(entry);
        }
      }
    });

    // process properties
    var props = JSON.parse(JRD).properties;
    for (var key in props) {
      if (props.hasOwnProperty(key)) {
        if (key === 'http://packetizer.com/ns/name') {
          result.idx.properties.name = props[key];
        }
      }
    }
    cb(null, result);
  };

  WebFinger.prototype.lookup = function (address, cb) {
    if (typeof address !== 'string') {
      throw new Error('first parameter must be a user address');
    } else if (typeof cb !== 'function') {
      throw new Error('second parameter must be a callback');
    }

    var self = this;
    var parts = address.replace(/ /g,'').split('@');
    var host = parts[1];    // host name for this useraddress
    var uri_index = 0;      // track which URIS we've tried already
    var protocol = 'https'; // we use https by default

    if (parts.length !== 2) {
      cb(_err({ message: 'invalid user address ' + address + ' ( expected format: user@host.com )' }));
      return false;
    } else if (self._isLocalhost(host)) {
      protocol = 'http';
    }

    function _buildURL() {
      return protocol + '://' + host + '/.well-known/' +
             URIS[uri_index] + '?resource=acct:' + address;
    }

    // control flow for failures, what to do in various cases, etc.
    function _fallbackChecks(err) {
      if ((self.config.uri_fallback) && (host !== 'webfist.org') && (uri_index !== URIS.length - 1)) { // we have uris left to try
        uri_index = uri_index + 1;
        _call();
      } else if ((!self.config.tls_only) && (protocol === 'https')) { // try normal http
        uri_index = 0;
        protocol = 'http';
        _call();
      } else if ((self.config.webfist_fallback) && (host !== 'webfist.org')) { // webfist attempt
        uri_index = 0;
        protocol = 'http';
        host = 'webfist.org';
        // webfist will
        // 1. make a query to the webfist server for the users account
        // 2. from the response, get a link to the actual webfinger json data
        //    (stored somewhere in control of the user)
        // 3. make a request to that url and get the json
        // 4. process it like a normal webfinger response
        self._fetchJRD(_buildURL(), function (err, data) { // get link to users JRD
          if (err) {
            cb(err);
            return false;
          }
          self._processJRD(data, function (err, result) {
            if ((typeof result.idx.links.webfist === 'object') &&
                (typeof result.idx.links.webfist[0].href === 'string')) {
              self._fetchJRD(result.idx.links.webfist[0].href, function (err, JRD) {
                if (err) {
                  cb(err);
                } else {
                  self._processJRD(JRD, cb);
                }
              });
            }
          });
        });
      } else {
        cb(err);
        return false;
      }
    }

    function _call() {
      // make request
      self._fetchJRD(_buildURL(), function (err, JRD) {
        if (err) {
          _fallbackChecks(err);
        } else {
          self._processJRD(JRD, cb);
        }
      });
    }

    setTimeout(_call, 0);
  };

  if (typeof window === 'object') {
    window.WebFinger = WebFinger;
  } else if (typeof (define) === 'function' && define.amd) {
    define([], function () { return WebFinger; });
  } else {
    try {
      module.exports = WebFinger;
    } catch (e) {}
  }
})();



/** FILE: src/authorize.js **/
(function (global) {

  function extractParams() {
    //FF already decodes the URL fragment in document.location.hash, so use this instead:
    var location = RemoteStorage.Authorize.getLocation(),
        hashPos  = location.href.indexOf('#'),
        hash;
    if (hashPos === -1) { return; }
    hash = location.href.substring(hashPos+1);
    // if hash is not of the form #key=val&key=val, it's probably not for us
    if (hash.indexOf('=') === -1) { return; }
    return hash.split('&').reduce(function (m, kvs) {
      var kv = kvs.split('=');
      m[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1]);
      return m;
    }, {});
  }

  RemoteStorage.ImpliedAuth = function (storageApi, redirectUri) {
    RemoteStorage.log('ImpliedAuth proceeding due to absent authURL; storageApi = ' + storageApi + ' redirectUri = ' + redirectUri);
    // Set a fixed access token, signalling to not send it as Bearer
    remoteStorage.remote.configure({
      token: RemoteStorage.Authorize.IMPLIED_FAKE_TOKEN
    });
    document.location = redirectUri;
  };

  RemoteStorage.Authorize = function (authURL, scope, redirectUri, clientId) {
    RemoteStorage.log('[Authorize] authURL = ', authURL, 'scope = ', scope, 'redirectUri = ', redirectUri, 'clientId = ', clientId);

    var url = authURL, hashPos = redirectUri.indexOf('#');
    url += authURL.indexOf('?') > 0 ? '&' : '?';
    url += 'redirect_uri=' + encodeURIComponent(redirectUri.replace(/#.*$/, ''));
    url += '&scope=' + encodeURIComponent(scope);
    url += '&client_id=' + encodeURIComponent(clientId);
    if (hashPos !== -1) {
      url += '&state=' + encodeURIComponent(redirectUri.substring(hashPos+1));
    }
    url += '&response_type=token';
    RemoteStorage.Authorize.setLocation(url);
  };

  RemoteStorage.Authorize.IMPLIED_FAKE_TOKEN = false;

  RemoteStorage.prototype.authorize = function (authURL) {
    this.access.setStorageType(this.remote.storageType);
    var scope = this.access.scopeParameter;

    var redirectUri = String(RemoteStorage.Authorize.getLocation());
    var clientId = redirectUri.match(/^(https?:\/\/[^\/]+)/)[0];

    RemoteStorage.Authorize(authURL, scope, redirectUri, clientId);
  };

  /**
   * Get current document location
   *
   * Override this method if access to document.location is forbidden
   */
  RemoteStorage.Authorize.getLocation = function () {
    return global.document.location;
  };

  /**
   * Set current document location
   *
   * Override this method if access to document.location is forbidden
   */
  RemoteStorage.Authorize.setLocation = function (location) {
    if (typeof location === 'string') {
      global.document.location.href = location;
    } else if (typeof location === 'object') {
      global.document.location = location;
    } else {
      throw "Invalid location " + location;
    }
  };

  RemoteStorage.prototype.impliedauth = function () {
    RemoteStorage.ImpliedAuth(this.remote.storageApi, String(document.location));
  };

  RemoteStorage.Authorize._rs_supported = function () {
    return typeof(document) !== 'undefined';
  };

  var onFeaturesLoaded;
  RemoteStorage.Authorize._rs_init = function (remoteStorage) {

    onFeaturesLoaded = function () {
      var authParamsUsed = false;
      if (params) {
        if (params.error) {
          throw "Authorization server errored: " + params.error;
        }
        if (params.access_token) {
          remoteStorage.remote.configure({
            token: params.access_token
          });
          authParamsUsed = true;
        }
        if (params.remotestorage) {
          remoteStorage.connect(params.remotestorage);
          authParamsUsed = true;
        }
        if (params.state) {
          RemoteStorage.Authorize.setLocation('#'+params.state);
        }
      }
      if (!authParamsUsed) {
        remoteStorage.remote.stopWaitingForToken();
      }
    };
    var params = extractParams(),
        location;
    if (params) {
      location = RemoteStorage.Authorize.getLocation();
      location.hash = '';
    }
    remoteStorage.on('features-loaded', onFeaturesLoaded);
  };

  RemoteStorage.Authorize._rs_cleanup = function (remoteStorage) {
    remoteStorage.removeEventListener('features-loaded', onFeaturesLoaded);
  };

})(typeof(window) !== 'undefined' ? window : global);


/** FILE: src/access.js **/
(function(global) {

  var SETTINGS_KEY = "remotestorage:access";

  /**
   * Class: RemoteStorage.Access
   *
   * Keeps track of claimed access and scopes.
   */
  RemoteStorage.Access = function() {
    this.reset();
  };

  RemoteStorage.Access.prototype = {

    /**
     * Method: claim
     *
     * Claim access on a given scope with given mode.
     *
     * Parameters:
     *   scope - An access scope, such as "contacts" or "calendar"
     *   mode  - Access mode. Either "r" for read-only or "rw" for read/write
     *
     * Example:
     *   (start code)
     *   remoteStorage.access.claim('contacts', 'r');
     *   remoteStorage.access.claim('pictures', 'rw');
     *   (end code)
     *
     * Root access:
     *   Claiming root access, meaning complete access to all files and folders
     *   of a storage, can be done using an asterisk:
     *
     *   (start code)
     *   remoteStorage.access.claim('*', 'rw');
     *   (end code)
     */
    claim: function(scope, mode) {
      if (typeof(scope) !== 'string' || scope.indexOf('/') !== -1 || scope.length === 0) {
        throw new Error('Scope should be a non-empty string without forward slashes');
      }
      if (!mode.match(/^rw?$/)) {
        throw new Error('Mode should be either \'r\' or \'rw\'');
      }
      this._adjustRootPaths(scope);
      this.scopeModeMap[scope] = mode;
    },

    get: function(scope) {
      return this.scopeModeMap[scope];
    },

    remove: function(scope) {
      var savedMap = {};
      var name;
      for (name in this.scopeModeMap) {
        savedMap[name] = this.scopeModeMap[name];
      }
      this.reset();
      delete savedMap[scope];
      for (name in savedMap) {
        this.set(name, savedMap[name]);
      }
    },

    /**
     * Verify permission for a given scope.
     */
    checkPermission: function(scope, mode) {
      var actualMode = this.get(scope);
      return actualMode && (mode === 'r' || actualMode === 'rw');
    },

    /**
     * Verify permission for a given path.
     */
    checkPathPermission: function(path, mode) {
      if (this.checkPermission('*', mode)) {
        return true;
      }
      return !!this.checkPermission(this._getModuleName(path), mode);
    },

    reset: function() {
      this.rootPaths = [];
      this.scopeModeMap = {};
    },

    /**
     * Return the module name for a given path.
     */
    _getModuleName: function(path) {
      if (path[0] !== '/') {
        throw new Error('Path should start with a slash');
      }
      var moduleMatch = path.replace(/^\/public/, '').match(/^\/([^\/]*)\//);
      return moduleMatch ? moduleMatch[1] : '*';
    },

    _adjustRootPaths: function(newScope) {
      if ('*' in this.scopeModeMap || newScope === '*') {
        this.rootPaths = ['/'];
      } else if (! (newScope in this.scopeModeMap)) {
        this.rootPaths.push('/' + newScope + '/');
        this.rootPaths.push('/public/' + newScope + '/');
      }
    },

    _scopeNameForParameter: function(scope) {
      if (scope.name === '*' && this.storageType) {
        if (this.storageType === '2012.04') {
          return '';
        } else if (this.storageType.match(/remotestorage-0[01]/)) {
          return 'root';
        }
      }
      return scope.name;
    },

    setStorageType: function(type) {
      this.storageType = type;
    }
  };

  /**
   * Property: scopes
   *
   * Holds an array of claimed scopes in the form
   * > { name: "<scope-name>", mode: "<mode>" }
   */
  Object.defineProperty(RemoteStorage.Access.prototype, 'scopes', {
    get: function() {
      return Object.keys(this.scopeModeMap).map(function(key) {
        return { name: key, mode: this.scopeModeMap[key] };
      }.bind(this));
    }
  });

  Object.defineProperty(RemoteStorage.Access.prototype, 'scopeParameter', {
    get: function() {
      return this.scopes.map(function(scope) {
        return this._scopeNameForParameter(scope) + ':' + scope.mode;
      }.bind(this)).join(' ');
    }
  });

  // Documented in src/remotestorage.js
  Object.defineProperty(RemoteStorage.prototype, 'access', {
    get: function() {
      var access = new RemoteStorage.Access();
      Object.defineProperty(this, 'access', {
        value: access
      });
      return access;
    },
    configurable: true
  });

  RemoteStorage.Access._rs_init = function() {};
})(typeof(window) !== 'undefined' ? window : global);


/** FILE: src/env.js **/
(function (pMode) {

  var mode = pMode,
      env = {},
      isBackground = false;


  RemoteStorage.Env = function () {
    return env;
  };

  RemoteStorage.Env.isBrowser = function () {
    return mode === "browser";
  };

  RemoteStorage.Env.isNode = function () {
    return mode === "node";
  };

  RemoteStorage.Env.goBackground = function () {
    isBackground = true;
    RemoteStorage.Env._emit("background");
  };

  RemoteStorage.Env.goForeground = function () {
    isBackground = false;
    RemoteStorage.Env._emit("foreground");
  };

  RemoteStorage.Env._rs_init = function (remoteStorage) {
    RemoteStorage.eventHandling(RemoteStorage.Env, "background", "foreground");

    function visibility() {
      if (document[env.hiddenProperty]) {
        RemoteStorage.Env.goBackground();
      } else {
        RemoteStorage.Env.goForeground();
      }
    }

    if ( mode === 'browser') {
      if ( typeof(document.hidden) !== "undefined" ) {
        env.hiddenProperty = "hidden";
        env.visibilityChangeEvent = "visibilitychange";
      } else if ( typeof(document.mozHidden) !== "undefined" ) {
        env.hiddenProperty = "mozHidden";
        env.visibilityChangeEvent = "mozvisibilitychange";
      } else if ( typeof(document.msHidden) !== "undefined" ) {
        env.hiddenProperty = "msHidden";
        env.visibilityChangeEvent = "msvisibilitychange";
      } else if ( typeof(document.webkitHidden) !== "undefined" ) {
        env.hiddenProperty = "webkitHidden";
        env.visibilityChangeEvent = "webkitvisibilitychange";
      }
      document.addEventListener(env.visibilityChangeEvent, visibility, false);
      visibility();
    }
  };

  RemoteStorage.Env._rs_cleanup = function (remoteStorage) {
  };

})(typeof(window) !== 'undefined' ? 'browser' : 'node');

