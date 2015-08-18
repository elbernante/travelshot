var tsf = (function ($) {

    var util = function ($) {
        var _utils = {
            functionify: function (func) {
                return ('function' === typeof func)
                    ? func : function() {/*no-op*/};
            },

            errorHanlder: function (jqXHR, textStatus, errorThrown, callback) {
                // TODO: Remove log
                console.log("ERROR:" + textStatus + " : " + errorThrown);
                var data = {};
                try {
                    data = $.parseJSON(jqXHR.responseText);
                    data = (data['error']) ? data : {error: data};
                } catch (err) {
                    data = {error: jqXHR.responseText};
                }
                _utils.functionify(callback)(data);
            }
        };

        return _utils;
    }($);

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
                util.functionify(req.callback)(g[req.key]);
            }
        };

        var requestKeys = function(successCallback, errorCallback) {
            $.ajax({
                type: 'GET',
                url: '/api/requestlogin/',
                headers: {'X-CSRFToken': g['csrfToken']},
                dataType: 'json',
                success: function(data, textStatus, jqXHR) {
                    util.functionify(successCallback)(data);
                },
                error: function(jqXHR, textStatus, errorThrown) {
                    util.errorHanlder(jqXHR, textStatus, errorThrown, errorCallback);
                }
            });
        };

        return {
            init: function (callback) {
                if (!g['csrfToken']) {
                    g['csrfToken'] = $('meta[name=csrf-token]').attr('content');
                }
                requestKeys(function (data) {
                    for (key in data) {
                        g[key] = data[key];
                    }
                    processQueue();
                    util.functionify(callback)(data);
                }, callback);
            },
            // refreshKeys: function (callback) {
            //     requestKeys(function (data) {
            //         g['state'] = data['state'];
            //         util.functionify(callback)(data);
            //     }, callback);
            // },
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

        ApiLib.prototype.loadScript = function (src, props, id) {
            var js,
                d = document,
                s = 'script',
                st = d.getElementsByTagName(s)[0];

            if (d.getElementById(id)){return;}

            js = d.createElement(s);
            js.id = id;
            js.src = src;
            $.extend(js, props);

            st.parentNode.insertBefore(js, st);
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
                        console.log('TODO: Failed to init keys. Reload page.');
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
                    gapi.auth2.init(APP_GLOBALS.get('gplus_options'));
                    self._initStatus = 2;
                    self.fireEvent('init');
                });
            }
        };

        _apis.gApi.load = function() {
            var self = this;
            self.loadScript(
                '//apis.google.com/js/client:platform.js',
                {async: true, defer: true, onload: function () {
                    self.isLoaded(true);
                }},
                'gplus-jssdk'
            );
        };

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

        _apis.fbApi.load = function() {
            var self = this;
            window.fbAsyncInit = function() {
                self.isLoaded(true);
            };
            self.loadScript(
                '//connect.facebook.net/en_US/sdk.js',
                {async: true, defer: true},
                'facebook-jssdk'
            );
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
        _apis.gApi.load();
        _apis.fbApi.load();

        return _apis;
    }($);
    /////////////////////// END API LOADING HANLDER ///////////////////////

    return {
        initAuthApis: function (callback) {
            var self = this;
            if (apiMonitor.gApi.isInitiated() && apiMonitor.fbApi.isInitiated()) {
                util.functionify(callback)();
            } else {
                apiMonitor.tsApi.on('complete', function () {
                    util.functionify(callback)();
                }, true);
                apiMonitor.tsApi.initApi();
            }
        },

        googleLogin: function (callback) {
            var funcCallback = util.functionify(callback);
            
            gapi.auth2.getAuthInstance().grantOfflineAccess({
                "redirect_uri": "postmessage",
                "include_granted_scopes": true 
            }).then(function (authResult) {
                if (authResult['code']) {
                    $.ajax({
                        type: 'POST',
                        url: '/api/gconnect/',
                        headers: {'X-CSRFToken': APP_GLOBALS.get('csrfToken')},
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
                            util.errorHanlder(jqXHR, textStatus, errorThrown, funcCallback);
                        }
                    });
                } else {
                    // TODO: Notify user for error
                    console.log("ERROR: Unable to get authorization code.")
                    funcCallback({error: "Unable to get authorization code."});
                }
            });
        },

        facebookLogin: function (callback) {
            var funcCallback = util.functionify(callback);

            FB.login(function(response){
                console.dir(response);
                if (response.authResponse) {
                    console.log("Success FB login");
                    $.ajax({
                        type: 'POST',
                        url: '/api/fbconnect/',
                        headers: {'X-CSRFToken': APP_GLOBALS.get('csrfToken')},
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
                            util.errorHanlder(jqXHR, textStatus, errorThrown, funcCallback);
                        }
                    });
                } else {
                    funcCallback({"error": "Unable to authenticate."});
                }
            }, {
                scope: 'public_profile email'
            });
        },

        newItem: function (itemObj) {
            var prog = function () {
                console.log("PROGRESS LISTENER");
                console.dir(arguments);
            }

            var ajaxUpload = new AjaxUpload({
                headers: {'X-CSRFToken': APP_GLOBALS.get('csrfToken')},
                progress: prog,
                error: prog
            });

            ajaxUpload.submit('/api/upload/', $.extend({}, itemObj));
        }
    }
})(jQuery);

// --- UI Scripts ---

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


$('#submitPhoto').on('click', function (event) {
    var cat = $('#imgCat').val();
    var title = $('#imgTitle').val();
    var desck = $('#imgDesc').val();
    pu.data('photoupload').submit(title, cat, desck);
});


$('#ajaxSubmit').on('click', function (event) {

    var d = {
        title: $('#imgTitle').val(),
        category: $('#imgCat').val(),
        description: $('#imgDesc').val(),
        image: $('#dz1').imagedrop('file')
    };

    tsf.newItem(d);
});


$('#signinButton').on('click', function (event) {
    $('#googleSignIn').prop('disabled', true);
    $('#facebookSignIn').prop('disabled', true);
    tsf.initAuthApis(function (data) {
        $('#googleSignIn').prop('disabled', false);
        $('#facebookSignIn').prop('disabled', false);
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


$('.imagedropzone').imagedrop({
    maxFileSize: 8 * 1024 * 1024,
    onInvalidFile: function (element, file) {
        console.log("Invavlid file " + file.name || "" + ".");
    },
    onChange: function(element, file) {
        console.log("Change: " + ((file) ? (file.name || 'No File Name') : 'None'));
    }
});


$('#dropbutton').on('click', function (event) {
    console.log($('#dz2').imagedrop('file'));
});


$('#switchDrop').on('click', function (event) {
    var i1 = $('#dz1').imagedrop('file');
    var i2 = $('#dz2').imagedrop('file');
    $('#dz1').imagedrop('file', i2);
    $('#dz2').imagedrop('file', i1);
});


$('#clearDrop').on('click', function (event) {
   $('#dz2').imagedrop('clearFile');
});


$('#spreadDrop').on('click', function (event) {
   var i1 = $('.imagedropzone').imagedrop('file');
   $('.imagedropzone').imagedrop(i1 ? 'file' : 'clearFile', i1);
});

$('#getDrop').on('click', function (event) {
    var i1 = $('#dz1').imagedrop('file');
    var reader = new FileReader();

    console.log(i1 instanceof File);
    reader.onload = function (e) {
        //console.log(this.result);
        console.log(btoa(this.result));
    }
    //reader.readAsDataURL(i1);
    reader.readAsBinaryString(i1);
});


