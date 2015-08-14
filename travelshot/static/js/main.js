// Initiate PhotoUpload plugin
var pu = $('.photoupload').photoupload({
    url: '/api/upload/',
    maxFileSize: 8 * 1024 * 1024,
    onInvalidFile: function (file) {
        console.log("Invavlid file " + file.name || "" + ".");
    },
    onUploadProgress: function(element, progress) {
        console.log("Porgess: " + progress);
    }
});


var tsf = (function ($) {
    var _functionify = function (func) {
        return ('function' === typeof func) 
            ? func : function() {/*no-op*/};
    };

    /////////////////////// BEGIN APP_GLOBALS ///////////////////////
    var APP_GLOBALS = (function($) {
        var g = {};
        var getRequestQueue = [];
        var processQueue = function() {
            if ('undefined' === g['state']) {
                return;
            }          
            while (getRequestQueue.length > 0) {
                req = getRequestQueue.shift();
                _functionify(req.callback)(g[req.key]);
            }
        };

        var errorHandler = function (jqXHR, textStatus, errorThrown, callback) {
            console.log("ERROR:" + textStatus + " : " + errorThrown);
            var data = {};
            try {
                data = $.parseJSON(jqXHR.responseText);
            } catch (err) {
                data = {'error': jqXHR.responseText};
            }
            _functionify(callback)(data);
        };

        var requestKeys = function(successCallback, errorCallback) {
            $.ajax({
                type: 'GET',
                url: '/api/requestlogin/',
                dataType: 'json',
                success: function(data, textStatus, jqXHR) {
                    _functionify(successCallback)(data);
                },
                error: function(jqXHR, textStatus, errorThrown) {
                    errorHandler(jqXHR, textStatus, errorThrown, errorCallback);
                }
            });
        };

        return {
            init: function (callback) {
                requestKeys(function (data) {
                    for (key in data) {
                        g[key] = data[key];
                    }
                    processQueue();
                    _functionify(callback)(data);
                }, callback);
            },
            refreshKeys: function (callback) {
                requestKeys(function (data) {
                    g['state'] = data['state'];
                    _functionify(callback)(data);
                }, callback);
            },
            asyncGet: function (key, callback) {
                getRequestQueue.push({key: key, callback: callback});
                processQueue();
            },
            get: function (key) {
                return g[key];
            },
            set: function (key, value) {
                g[key] = value;
            }
        }
    })($);
    /////////////////////// END APP_GLOBALS ///////////////////////

    /////////////////////// API LOADING HANLDER ///////////////////////
    var apiMonitor = function ($) {

        var ApiLib = function () {
            this._isLibloaded = false;
            this._initStatus = 0;
            this._listeners = {'load': [], 'init': [], 'complete': []};
            return this;
        };

        ApiLib.prototype.isLoaded = function (bool) {
            if ('undefined' === typeof bool) {
                return this._isLibloaded;
            } else {
                this._isLibloaded = bool;
                if (bool) {
                    this.fireEvent('load');
                }
            }
        };

        ApiLib.prototype.isInitiated = function () {
            return 2 === this._initStatus;
        };

        ApiLib.prototype.fireEvent = function (key) {
            var self = this;
            self._listeners[key] = self._listeners[key].filter(function (obj, i) {
                obj['func'](self, key);
                return !(obj['removeAfterInvoke']);
            });
        };

        ApiLib.prototype.on = function (key, func, removeAfterInvoke) {
            var self = this;
            if ('undefined' !== self._listeners[key]
                    && 'function' === typeof func) {
                self._listeners[key].push({
                    func: func,
                    removeAfterInvoke: removeAfterInvoke
                });
            }
        };

        var _apis = {
            tsApi: new ApiLib(),
            gApi: new ApiLib(),
            fbApi: new ApiLib()
        };

        _apis.tsApi.initApi = function () {
            var self = this;
            if (0 === self._initStatus) {
                self._initStatus = 1;
                APP_GLOBALS.init(function (data) {
                    if (data && data['state']) {
                        self._initStatus = 2;
                        self.fireEvent('init');
                    } else {
                        self._initStatus = 0;
                        consoler.log('TODO: Failed to init keys. Reload page.');
                    }
                });
            }
            self.hasApiInitChange();
        };

         _apis.tsApi.hasApiInitChange = function () {
            var self = this;
            if (_apis.gApi.isInitiated() && _apis.fbApi.isInitiated()) {
                self.fireEvent('complete');
            }
         };

        // G Plus API Handler
        _apis.gApi.initApi = function () {
            var self = this;
            if (self.isLoaded() 
                    && 0 === self._initStatus 
                    && _apis.tsApi.isInitiated()) {
                self._initStatus = 1;
                gapi.load('auth2', function() {
                    auth2 = gapi.auth2.init(APP_GLOBALS.get('gplus_options'));
                    self._initStatus = 2;
                    self.fireEvent('init');
                });
            }
        }

        // Facebook API Handler
        _apis.fbApi.initApi = function () {
            var self = this;
            if (self.isLoaded() 
                    && 0 === self._initStatus
                    && _apis.tsApi.isInitiated()) {
                self._initStatus = 1;
                FB.init(APP_GLOBALS.get('fb_options'));
                self._initStatus = 2;
                self.fireEvent('init');
            }
        };

        _apis.gApi.on('init', function() {
            _apis.tsApi.hasApiInitChange();
        });

        _apis.fbApi.on('init', function() {
            _apis.tsApi.hasApiInitChange();
        });

        _apis.tsApi.on('init', function () {
            _apis.gApi.initApi();
            _apis.fbApi.initApi();
        });

        _apis.gApi.on('load', function () {
            _apis.gApi.initApi();
        });

        _apis.fbApi.on('load', function () {
            _apis.fbApi.initApi();
        });

        // Start initializing APIs
        _apis.tsApi.initApi();

        return _apis;
    }($);
    /////////////////////// END API LOADING HANLDER ///////////////////////

    return {
        testfunc: function() {
            console.log(this);
        },
        googleLibLoaded: function () {
            apiMonitor.gApi.isLoaded(true);
        },
        facebookLibLoaded: function () {
            apiMonitor.fbApi.isLoaded(true);
        },
        refreshLoginToken: function (callback) {
            var self = this;
            if (apiMonitor.gApi.isInitiated() && apiMonitor.fbApi.isInitiated()) {
                APP_GLOBALS.refreshKeys(callback);
            } else {
                apiMonitor.tsApi.on('complete', function () {
                    APP_GLOBALS.refreshKeys(callback);
                }, true);
                apiMonitor.tsApi.initApi();
            }
        },
        googleLogin: function (callback) {
            var funcCallback = _functionify(callback);
            
            gapi.auth2.getAuthInstance().grantOfflineAccess({
                "redirect_uri": "postmessage",
                "include_granted_scopes": true 
            }).then(function (authResult) {
                if (authResult['code']) {
                    $.ajax({
                        type: 'POST',
                        url: '/api/gconnect/',
                        headers: {'X-Ts-Login-Token': APP_GLOBALS.get('state')},
                        processData: false,
                        contentType: 'application/octet-stream; charset=utf-8',
                        data: authResult['code'],
                        success: function(data, textStatus, jqXHR) {
                            // TODO: Check if successful login, or user is already logged in.
                            console.log("Success! User logged in Google.");
                            console.dir(data);
                            funcCallback(data);
                        },
                        error: function(jqXHR, textStatus, errorThrown) {
                            var tsErr = {};
                            try {
                                tsErr = $.parseJSON(jqXHR.responseText);
                            } catch (err) {
                                tsErr = {"error": jqXHR.responseText};
                            }
                            funcCallback(tsErr);
                        }
                    });
                } else {
                    // TODO: Notify user for error
                    console.log("ERROR: Unable to get authorization code.")
                    funcCallback({"error": "Unable to get authorization code."});
                }
            });
        },
        facebookLogin: function (callback) {
            var funcCallback = _functionify(callback);

            FB.login(function(response){
                console.dir(response);
                if (response.authResponse) {
                    console.log("Success FB login");
                    $.ajax({
                        type: 'POST',
                        url: '/api/fbconnect/',
                        headers: {'X-Ts-Login-Token': APP_GLOBALS.get('state')},
                        processData: false,
                        contentType: 'application/octet-stream; charset=utf-8',
                        data: response.authResponse['accessToken'],
                        success: function(data, textStatus, jqXHR) {
                            // TODO: Check if successful login, or user is already logged in.
                            console.log("Success! User logged in Facebook.");
                            console.dir(data);
                            funcCallback(data);
                        },
                        error: function(jqXHR, textStatus, errorThrown) {
                            var tsErr = {};
                            try {
                                tsErr = $.parseJSON(jqXHR.responseText);
                            } catch (err) {
                                tsErr = {"error": jqXHR.responseText};
                            }
                            funcCallback(tsErr);
                        }
                    });
                } else {
                    funcCallback({"error": "Unable to authenticate."});
                }
            }, {
                scope: 'public_profile email'
            });
        }
    }
})(jQuery);


// --- Google Login ---
function initGApi() {
    tsf.googleLibLoaded();
}

// --- Facebook Login ---
window.fbAsyncInit = function() {
    tsf.facebookLibLoaded();
};

(function(d, s, id){
    var js, fjs = d.getElementsByTagName(s)[0];
    if (d.getElementById(id)) {return;}
    js = d.createElement(s); js.id = id;
    js.src = "//connect.facebook.net/en_US/sdk.js";
    fjs.parentNode.insertBefore(js, fjs);
}(document, 'script', 'facebook-jssdk'));

// --- UI Scripts ---
$('#submitPhoto').on('click', function (event) {
    pu.data('photoupload').submit();
});

$('#signinButton').on('click', function (event) {
    $('#googleSignIn').prop('disabled', true);
    $('#facebookSignIn').prop('disabled', true);
    tsf.refreshLoginToken(function (data) {
        if (!data['error']) {
            $('#googleSignIn').prop('disabled', false);
            $('#facebookSignIn').prop('disabled', false);
        } else {
            alert('TODO: Show error to user. Error: ' + data['error']);
        }
    });
});

$('#googleSignIn').click(function (event) {
    tsf.googleLogin(function (data) {
        // TODO: Check for login error
        console.log('Google login complete.');
        console.dir(data);
    });
});

$('#facebookSignIn').click(function (event) {
    // TODO: Check for login error
    tsf.facebookLogin(function (data) {
        console.log('Facebook login complete.');
        console.dir(data);
    });
});
