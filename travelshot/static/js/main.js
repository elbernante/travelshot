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

    $(function () {

        var NavBar = Segue.Class('NavBar', {
            base: Segue.Element,
            init: function () {
                Segue.Element.call(this, {
                    templateNode: $('#page-nav-bar').get(0),
                    model: {}
                });

                var self = this,
                    $html = $(self.html());

                self.isAnimationInQueue = false,
                self.triggerPoint = 100;
                self.isUpdateCancelled = false;
                self.mointorFunc = function () {
                    self.didScrollMonitor.apply(self, arguments);
                };

                self.monitorScroll(true);

                Segue.on('pageLoad', function (pageObj) {
                    self.setMode(pageObj.navbar);
                });

                return self;
            },

            setMode: function (mode) {
                var self = this,
                    $html = $(self.html());

                self.monitorScroll(false);
                if ('shrink' === mode) {
                    self.isUpdateCancelled = true;
                    $html.removeClass('navbar-grow');
                } else if ('grow' === mode) {
                    self.isUpdateCancelled = true;
                    $html.addClass('navbar-grow');
                } else {
                    self.isUpdateCancelled = false;
                    self.monitorScroll(true);
                }
                return self;
            },

            updateDisplay: function () {
                var self = this,
                    atPoint = $w.scrollTop(),
                    $html = $(self.html());

                if (self.isUpdateCancelled) {
                    self.isUpdateCancelled = false;
                    return self;
                }

                if (atPoint > self.triggerPoint) {
                    $html.removeClass('navbar-grow');
                } else {
                    $html.addClass('navbar-grow');
                }
                self.isAnimationInQueue = false;

                return self;
            },

            didScrollMonitor: function (event) {
                var self = this;
                if (!self.isAnimationInQueue) {
                    self.isAnimationInQueue = true;
                    setTimeout(function () {
                        self.updateDisplay();
                    }, 250);
                }
            },

            monitorScroll: function (shouldMonitor) {
                var self = this;
                if (shouldMonitor) {
                    $w.on('scroll', self.mointorFunc);
                    self.updateDisplay();
                } else {
                    $w.off('scroll', self.mointorFunc);
                }
                return self;
            }
        });

        var Cover = Segue.Class('Cover', {
            base: Segue.Element,
            init: function () {
                Segue.Element.call(this, {
                    templateNode: $('#page-cover').get(0),
                    model: {}
                });

                var self = this;
                    $html = $(self.html());

                self.images = [];
                self.pageWantsCover = false;

                self.parallax = $html.find('.featured_shots').parallax();
                self.banner = $html.find('.slideshow').slideshow();

                Segue.on('pageLoad', function (pageObj) {
                    self.pageWantsCover = pageObj.showCover;
                    self.updateDisplay();
                });

                return this;
            },

            updateDisplay: function () {
                var self = this;
                if (self.pageWantsCover && self.hasImages()) {
                    $html.removeClass('jumbotron-hidden');
                } else {
                    $html.addClass('jumbotron-hidden');
                }
                return self;
            },

            hasImages: function () {
                return this.images.length > 0;
            },

            addImage: function (imgUrl) {
                var self = this,
                    newImg = $('<img>').attr('src', imgUrl);

                newImg.one('load', function () {
                    self.banner.slideshow('addImage', newImg).slideshow('start');
                    self.images.push(imgUrl);
                    self.updateDisplay();
                }).each(function () {
                    if (this.complete) $(this).load();
                });
                return self;
            }
        });

        var SPage = Segue.Class('SPage', {
            base: Segue.Page,
            init: function (title) {
                Segue.Page.apply(this, {});
                this.pageBody = $('#body-content').get(0);
                this.navbar = 'auto';
                this.showCover = false;
                this.title = title || 'No Page Title'
                return this;
            },

            dismiss: function () {
                console.log('dismmising page from subclass: ' + this.title);
                var self = this;
                $.each(self.elements, function (i, o) {
                    o.dismiss();
                });
                return self;
            },

            load: function () {
                console.log('Loading page from subclass: ' + this.title);
                var self = this,
                    $bod = $(self.pageBody || d.getElementById('body-content') || d.getElementsByTagName('body')[0]);

                $.each(self.elements, function (i, o) {
                    o.container = $bod;
                    o.load();
                });
                return self;
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
                    self.uncacheHtlm();
                });
                return self;
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
                return self;
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
                    self.uncacheHtlm();
                }
                return self;
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
                return self;
            }
        });

        var LoginPanel = Segue.Class('LoginPanel', {
            base: Segue.Element,
            init: function (loginBtns) {
                Segue.Element.call(this, {
                    templateNode: $('#login-panel').get(0),
                    model: {}
                });

                var self = this;
                $.each(loginBtns, function (i, o) {
                    self.addChildElement(new LoginButton(o));
                });

                return this;
            },

            dismiss: function () {
                var self = this,
                    $html = $(self.html());

                $.each(self.elements, function (i, o) {
                    o.dismiss();
                });

                $html.stop().slideUp('slow', function () {
                    $html.remove();
                    self.uncacheHtlm();
                });
                return self;
            },

            load: function () {
                var self = this,
                    $html = $(self.html()),
                    $buttonPlace = $(self.portals['button_list']);

                self.container.append($html);
                $html.stop().hide().slideDown('slow', function () {
                    $.each(self.elements, function (i, o) {
                        o.container = $buttonPlace;
                        o.load();
                    });
                });
                return self;
            }
        });

        var LoginButton = Segue.Class('LoginButton', {
            base: Segue.Element,
            init: function (loginBtn) {
                Segue.Element.call(this, {
                    templateNode: $('#login-button-template').get(0),
                    model: loginBtn
                });

                return this;
            },

            dismiss: function () {
                var self = this,
                    $html = $(self.html());

                $html.stop().slideUp('slow', function () {
                    $html.remove();
                    self.uncacheHtlm();
                });
                return self;
            },

            load: function () {
                var self = this,
                    $html = $(self.html());

                self.container.append($html);
                $html.stop().hide().slideDown('slow');
                return self;
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

        var navBar = new NavBar();
        w['navBar'] = navBar;

        var pageCover = new Cover();
        // TODO: Load only first image.
        //          load suceeding images 5 seconds later
        //          to allow the rest of the page to load first
        pageCover.addImage('static/images/cover_1.jpg');
        pageCover.addImage('static/images/cover_2.jpg');
        pageCover.addImage('static/images/cover_3.jpg');

        var homePage = new SPage('Home Page');
        homePage.showCover = true;
        homePage.addChildElement(new Panel(asiaPanel));
        homePage.addChildElement(new Panel(asiaPanel));

        //Segue.loadPage(homePage);
        w['myHomePage'] = homePage;

        var loginPage = new SPage('Login Page');
        loginPage.navbar = 'shrink';
        loginPage.showCover = false;
        loginPage.addChildElement(new LoginPanel([
            {
                buttonClass: 'gplus-button',
                displayText: 'Sign in with Goolge',
                hoverText: 'Google'
            },

            {
                buttonClass: 'fb-button',
                displayText: 'Sign in with Facebook',
                hoverText: 'Facebook'
            }
        ]));
        Segue.loadPage(loginPage);
        $('#signin').on('click', function (evt) {
            Segue.loadPage(loginPage, '/pages/login');
        });

        var uploadPage = new SPage('Upload Page');
        uploadPage.navbar = 'grow';
        uploadPage.showCover = true;
        $('#upload').on('click', function (evt) {
            Segue.loadPage(uploadPage, '/pages/upload');
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


