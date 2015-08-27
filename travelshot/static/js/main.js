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

            ajaxUpload.submit('/api/item/new/', $.extend({}, itemObj));
        }
    }
}(jQuery));


// --- UI Scripts ---
(function (w, d, $) {
    var $w = $(w),
        $d = $(d);

    $(function (){

        // Navbar animation
        var navbarAnimation = function () {
            var navBarElem = $('nav.navbar'),
                isAnimationInQueue = false,
                triggerPoint = 100;

            var animateNavbar = function () {
                var atPoint = $w.scrollTop();

                if (atPoint > triggerPoint) {
                    navBarElem.removeClass('navbar-grow');
                } else {
                    navBarElem.addClass('navbar-grow');
                }
                isAnimationInQueue = false;
            };

            $w.on('scroll', function (event) {
                if (!isAnimationInQueue) {
                    isAnimationInQueue = true;
                    setTimeout(animateNavbar, 250);
                }
            });
            animateNavbar();
        }();

        var parl = $('.featured_shots').parallax();
        var banner = $('.slideshow').slideshow().slideshow('start');

        // init Isotope
        // var $grid = $('.grid').isotope({
        //     itemSelector: '.grid-item',
        //     percentPosition: true,
        //     masonry: {
        //         columnWidth: '.grid-sizer'
        //     }
        // });
        

        // $w.load(function () {
        //    $('.grid').isotope('layout');
        // });


        // Page elements Classes
        var HomePage = Segue.Class('HomePage', {
            base: Segue.Page,
            init: function (title) {
                Segue.Page.apply(this, {});
                this.pageBody = $('#body-content').get(0);
                this.showBanner = false;
                this.title = title || 'No Page Title'
                return this;
            },

            dismiss: function () {
                console.log('dismmising page from subclass: ' + this.title);
                var self = this;
                $.each(self.elements, function (i, o) {
                    o.dismiss();
                });
            },

            load: function () {
                console.log('Loading page from subclass: ' + this.title);
                var self = this,
                    $bod = $(self.pageBody || d.getElementById('body-content') || d.getElementsByTagName('body')[0]);

                $.each(self.elements, function (i, o) {
                    o.container = $bod;
                    o.load();
                });
            }
        });

        var Panel = Segue.Class('Panel', {
            base: Segue.Element,
            init: function (panelObj) {
                Segue.Element.call(this, {
                    templateNode: $('#panel-template').get(0),
                    model: panelObj
                });

                for (var i = 0, l = panelObj.items.length; i < l; i++) {
                    this.addChildElement(new ItemEntry(panelObj.items[i]));
                }

                return this;
            },

            html: function () {
                if (this.cachedHtml) {
                    return this.cachedHtml;
                }

                var html = Segue.Element.prototype.html.call(this);

                // initialize isotope for this panel
                var $grid = $(this.portals['item_list']).isotope({
                    itemSelector: '.grid-item',
                    percentPosition: true,
                    masonry: {
                        columnWidth: '.grid-sizer'
                    }
                });

                return html;
            },

            dismiss: function () {
                var self = this,
                    $html = $(self.html());

                $.each(self.elements, function (i, o) {
                    o.dismiss();
                });

                $html.stop().hide('slow', function () {
                    $html.remove();
                    delete self.cachedHtml;
                });
            },

            load: function () {
                var self = this,
                    $html = $(self.html()),
                    $grid = $(self.portals['item_list']);

                self.container.append($html);
                $html.stop().hide().show('slow', function () {
                    $grid.isotope('layout');
                    $.each(self.elements, function (i, o) {
                        o.isotopeGrid = $grid;
                        o.load();
                    });
                });
            }
        });

        var ItemEntry = Segue.Class('ItemEntry', {
            base: Segue.Element,
            init: function (itemObj) {
                Segue.Element.call(this, {
                    templateNode: $('#grid-item-template').get(0),
                    model: itemObj
                });
                return this;
            },

            dismiss: function () {
                var self = this;
                if (self.isotopeGrid) {
                    self.isotopeGrid.isotope('remove', $(self.html()));
                    delete self.cachedHtml;
                }
            },

            load: function () {
                var self = this,
                    newItem = $(self.html());

                if (self.isotopeGrid) {
                    $(self.portals['item_image']).one('load', function () {
                        self.isotopeGrid.append(newItem).isotope('appended', newItem);
                    }).each(function () {
                        if (this.complete) $(this).load();
                    });
                }
            }
        });


        // Instantiations
        var asiaPanel = {
            title: Segue.bindable('Asia Town'),
            items: [
                {image_url: 'http://i.imgur.com/bwy74ok.jpg'},
                {image_url: 'http://i.imgur.com/bAZWoqx.jpg'},
                {image_url: 'http://i.imgur.com/PgmEBSB.jpg'},
                {image_url: 'http://i.imgur.com/aboaFoB.jpg'},
                {image_url: 'http://i.imgur.com/LkmcILl.jpg'},
                {image_url: 'http://i.imgur.com/q9zO6tw.jpg'},
                {image_url: 'http://i.imgur.com/r8p3Xgq.jpg'},
                {image_url: 'http://i.imgur.com/hODreXI.jpg'},
                {image_url: 'http://i.imgur.com/UORFJ3w.jpg'}
            ]
        };
        w['asiaPanel'] = asiaPanel;

        var homePage = new HomePage('Home Page');
        homePage.addChildElement(new Panel(asiaPanel));
        homePage.addChildElement(new Panel(asiaPanel));

        Segue.loadPage(homePage);
        w['myHomePage'] = homePage;

        $('#signin').on('click', function (evt) {
            Segue.loadPage(new HomePage('Login Page'), '/pages/login');
        });

        $('#upload').on('click', function (evt) {
            //w.history.pushState({HomePage: 'another index page'}, 'going to upload page', '/pages/upload/');
            Segue.loadPage(new HomePage('Upload Page'), '/pages/upload');
        });

        // var myModel = new function () {
        //     var self = this;
        //     this.color =  Segue.bindable('yellow');
        //     this.background =  Segue.bindable('blue');

        //     self.user = {
        //         firstName: Segue.bindable('John'),
        //         lastName:  Segue.bindable('Smith')
        //     };

        //     self.user.fullName = Segue.computed(function () {
        //         return self.user.lastName() + ', ' + self.user.firstName();
        //     }).subscribeTo(self.user.firstName, self.user.lastName);

        //     self.item = {
        //         image_url: Segue.bindable('http://i.imgur.com/UORFJ3w.jpg'),
        //         target: 'self'
        //     };
        // }; 

        // w['myModel'] = myModel;

        // var template = $('#grid-item-template').get(0);
        
        // var rootNode = d.importNode(template.content, true);
        // Segue.applyBindings(rootNode, myModel);

        // var newItem = $(rootNode.childNodes);
        // console.dir($('.grid').append(newItem).isotope('appended', newItem));

    });
})(window, document, jQuery);


