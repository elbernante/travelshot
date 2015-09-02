var TSF = (function ($) {

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
            },

            simpleGet: function (url, callback) {
                var funcCallback = _utils.functionify(callback);

                $.ajax({
                    type: 'GET',
                    url: url,
                    dataType: 'json',
                    success: function(data, textStatus, jqXHR) {
                        funcCallback(data);
                    },
                    error: function(jqXHR, textStatus, errorThrown) {
                        _utils.errorHanlder(jqXHR, textStatus, errorThrown, funcCallback);
                    }
                });
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

        g['csrfToken'] = $('meta[name=csrf-token]').attr('content');
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
                            APP_GLOBALS.set('user', data);
                            funcCallback(data);
                        },
                        error: function(jqXHR, textStatus, errorThrown) {
                            APP_GLOBALS.set('user', undefined);
                            util.errorHanlder(jqXHR, textStatus, errorThrown, funcCallback);
                        }
                    });
                } else {
                    APP_GLOBALS.set('user', undefined);
                    funcCallback({error: "Unable to get authorization code."});
                }
            });
        },

        facebookLogin: function (callback) {
            var funcCallback = util.functionify(callback);

            FB.login(function(response){
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
                            APP_GLOBALS.set('user', data);
                            funcCallback(data);
                        },
                        error: function(jqXHR, textStatus, errorThrown) {
                            APP_GLOBALS.set('user', undefined);
                            util.errorHanlder(jqXHR, textStatus, errorThrown, funcCallback);
                        }
                    });
                } else {
                    APP_GLOBALS.set('user', undefined);
                    funcCallback({"error": "Unable to authenticate."});
                }
            }, {
                scope: 'public_profile email'
            });
        },

        logout: function (callback) {
            var funcCallback = util.functionify(callback);
            APP_GLOBALS.set('user', undefined);

            util.simpleGet('/api/logout/', callback);
        },

        getSignedInUser: function (callback) {
            var funcCallback = util.functionify(callback);

            $.ajax({
                type: 'GET',
                url: '/api/currentuser/',
                headers: {'X-CSRFToken': APP_GLOBALS.get('csrfToken')},
                dataType: 'json',
                success: function(data, textStatus, jqXHR) {
                    if (data && data['name'] && data['picture'] ) {
                        APP_GLOBALS.set('user', data);
                    } else {
                        APP_GLOBALS.set('user', undefined);
                    }
                    funcCallback(data);
                },
                error: function(jqXHR, textStatus, errorThrown) {
                    util.errorHanlder(jqXHR, textStatus, errorThrown, funcCallback);
                }
            });
        },

        hasActiveUser: function (callback) {
            var funcCallback = util.functionify(callback);
            this.getSignedInUser(function (data) {
                if (!data['error'] && data['name'] && data['picture']) {
                    funcCallback(true);
                } else {
                    funcCallback(false);
                }
            });
        },

        currentUser: function () {
            return APP_GLOBALS.get('user');
        },

        getDataForPage: function (page, callback) {
            var p = (arguments.length > 0 && 'string' === typeof arguments[0]) ? page : '';
            p = (p.indexOf('?') > -1) ? p + '&d=1' : p + '?d=1';

            var f = (arguments.length > 1) ? arguments[1] : arguments[0];

            util.simpleGet(p, f);
        },

        getFeatured: function (callback) {
            util.simpleGet('/api/featured/', callback);
        },

        getCategories: function (callback) {
             util.simpleGet('/api/categories/', callback);
        },

        getItemsForCat: function (catId, callback) {
            util.simpleGet('/api/items/' + catId + '/', callback);
        },

        newItem: function (itemObj, callbacks) {
            var ajaxUpload = new AjaxUpload($.extend({
                resizeImageOnSize: 256 * 1024,
                headers: {'X-CSRFToken': APP_GLOBALS.get('csrfToken')}
            }, callbacks));

            ajaxUpload.submit('/api/item/new/', $.extend({}, itemObj));
        },

        getItem: function (id, callback) {
            util.simpleGet('/api/item/' + id + '/', callback);
        }
    }
}(jQuery));


// --- UI Scripts ---
(function (w, d, $) {
    var $w = $(w),
        $d = $(d);

    $(function () {

        var util = function () {
            var $alertBox = $('#alert-box');
            return {
                alert: function (message, title) {
                    $alertBox.find('.modal-title').text(title || 'Travel Shot');
                    $alertBox.find('.modal-body p').text(message);
                    $alertBox.modal('show');
                }
            };
        }();

        var NavBar = Segue.Class('NavBar', {
            base: Segue.Element,
            init: function () {
                var userObj = {
                    name: Segue.bindable(''),
                    photo: Segue.bindable('')
                };

                Segue.Element.call(this, {
                    templateNode: $('#page-nav-bar').get(0),
                    model: userObj
                });

                var self = this,
                    $html = $(self.html());

                self.user = userObj;
                self.clickActions = {};
                self.isAnimationInQueue = false,
                self.triggerPoint = 100;
                self.isUpdateCancelled = false;
                self._hideQueue = new Map();

                self.mointorFunc = function () {
                    self.didScrollMonitor.apply(self, arguments);
                };
                self.monitorScroll(true);

                var setBtnAct = function (btn, key) {
                    $(btn).find('>a:first-child').on('click', function (event) {
                        if ('function' === typeof self.clickActions[key]) {
                            self.clickActions[key]();
                        }
                    });
                };
                setBtnAct(self.portals['upload_button'], 'upload');
                setBtnAct(self.portals['login_button'], 'login');
                setBtnAct(self.portals['logout_button'], 'logout');

                Segue.on('pageLoad', function (pageObj) {
                    self._udateBtnsWithPage(pageObj);
                });

                // Listen to when user logged in/out
                 Segue.on('userevent', function () {
                    var cur_page = Segue.storybook['currentPage'];
                    if (cur_page) {
                        self._udateBtnsWithPage(cur_page);
                    }
                 });

                return self;
            },

            setActionFor: function (key, func) {
                var self = this;
                self.clickActions[key] = func;
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
            },

            _udateBtnsWithPage: function (pageObj) {
                var self = this;
                self.setMode(pageObj.navbar);
                if (pageObj.isLoginPage) {
                    self.hideButtons(true);
                } else {
                    self.hideUploadBtn(pageObj.isUploadPage);
                    var user = TSF.currentUser();
                    if (!user) {
                        self.hideLoginBtn(false);
                        self.hideUserBtn(true);
                    } else {
                        self.user.name(user.name);
                        self.user.photo(user.picture);
                        self.hideLoginBtn(true);
                        self.hideUserBtn(false);
                    }
                }
            },

            _clearHideIdFor: function (obj) {
                var self = this,
                    hqId = self._hideQueue.get(obj);
                if (hqId) {
                    clearTimeout(hqId);
                    self._hideQueue.delete(obj);
                }
            },

            _hideButton: function (navBtn) {
                var self = this,
                    $btn = $(navBtn);

                self._clearHideIdFor(navBtn);
                $btn.find('a').addClass('nav-a-btn-hidden');
                var hideId = setTimeout(function() {
                    $btn.addClass('hidden');
                    self._hideQueue.delete(navBtn);
                }, 250);
                self._hideQueue.set(navBtn, hideId);
            },

            _showButton: function (navBtn) {
                var self = this,
                    $btn = $(navBtn);

                self._clearHideIdFor(navBtn);
                $btn.removeClass('hidden');
                 var hideId = setTimeout(function() {
                    $btn.find('a').removeClass('nav-a-btn-hidden');
                    self._hideQueue.delete(navBtn);
                }, 200);
                self._hideQueue.set(navBtn, hideId);
            },

            hideLoginBtn: function (bool) {
                var self = this;
                if (bool) {
                    self._hideButton(self.portals['login_button']);
                } else {
                    self._showButton(self.portals['login_button']);
                }
                return self;
            },

            hideUploadBtn: function (bool) {
                var self = this;
                if (bool) {
                    self._hideButton(self.portals['upload_button']);
                } else {
                    self._showButton(self.portals['upload_button']);
                }
                return self;
            },

            hideUserBtn: function (bool) {
                var self = this;
                if (bool) {
                    self._hideButton(self.portals['user_button']);
                } else {
                    self._showButton(self.portals['user_button']);
                }
                return self;
            },

            hideButtons: function (bool) {
                this.hideLoginBtn(bool);
                this.hideUploadBtn(bool);
                this.hideUserBtn(bool);
                return this;
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

                this._isLoaded = false;
                this._isRendered = false;
                this._isRendering = false;

                if (panelObj instanceof Array) {
                    for (var i = 0, l = panelObj.items.length; i < l; i++) {
                        this.addChildElement(new ItemEntry(panelObj.items[i]));
                    }
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

            newItemArrived: function (itemEntryObj) {
                var self = this,
                    $grid = $(self.portals['item_list']);

                self.addChildElement(itemEntryObj);
                if (self._isLoaded) {
                    if (!self._isRendered) {
                        if (!self._isRendering) {
                            self._renderElement();
                        }
                    } else {
                        itemEntryObj.isotopeGrid = $grid;
                        itemEntryObj.load();
                    }
                }
                return self;
            },

            dismiss: function () {
                var self = this,
                    $html = $(self.html());

                self._isLoaded = false;
                self._isRendering = true;
                $.each(self.elements, function (i, o) {
                    o.dismiss();
                });

                $html.stop().hide('slow', function () {
                    $html.remove();
                    self.uncacheHtlm();
                    self._isRendering = false;
                    self._isRendered = false;
                });
                return self;
            },

            load: function () {
                var self = this,
                    $html = $(self.html());

                self._isLoaded = true;
                self._isRendering = true;
                self._isRendered = false;
                self.container.append($html);
                $html.hide();
                self._renderElement();
                return self;
            },

            _renderElement: function () {
                var self = this;
                self._isRendering = true;
                
                var $html = $(self.html()),
                    $grid = $(self.portals['item_list']);
               
                if (0 < self.elements.length) {
                    $html.show('slow', function () {
                        $grid.isotope('layout');
                        $.each(self.elements, function (i, o) {
                            o.isotopeGrid = $grid;
                            o.load();
                        });
                        self._isRendering = false;
                        self._isRendered = true;
                    });
                } else {
                    self._isRendering = false;
                }
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
        
        var MessagePannel = Segue.Class('MessagePannel', {
            base: Segue.Element,
            init: function (message) {
                Segue.Element.call(this, {
                    templateNode: $('#message-panel').get(0),
                    model: {
                        message: Segue.bindable(message || 'Nothing here')
                    }
                });

                return this;
            },

            setMessage: function (message) {
                this.options.model.message(message);
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
                $.each(self.elements, function (i, o) {
                    o.container = $buttonPlace;
                    o.disable(true);
                    o.load();
                });

                TSF.initAuthApis(function (data) {
                    $.each(self.elements, function (i, o) {
                        o.disable(false);
                    });
                });

                $html.stop().hide().slideDown('slow');
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

            html: function () {
                if (this.cachedHtml) {
                    return this.cachedHtml;
                }

                var self = this;
                var html = Segue.Element.prototype.html.call(this);

                // bind onclick event
                $(html).on('click', function (event) {
                    if ('function' === typeof self.options.model['click']) {
                        self.options.model['click'].apply(self.options.model, arguments);
                    }
                });
                
                return html;
            },

            disable: function (bool) {
                var self = this,
                    $html = $(self.html());

                if (0 < arguments.length) {
                    $html.attr('disabled', !(!(bool)));
                } else {
                    $html.attr('disabled', true);
                }

                return self;
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

        var UploadPanel = Segue.Class('UploadPanel', {
            base: Segue.Element,
            init: function () {
                Segue.Element.call(this, {
                    templateNode: $('#upload-panel-template').get(0),
                    model: {}
                });

                return this;
            },

            html: function () {
                if (this.cachedHtml) {
                    return this.cachedHtml;
                }

                var html = Segue.Element.prototype.html.call(this);

                var self = this;

                // Get Item categories
                TSF.getCategories(function (data) {
                    if (!data['error'] && data instanceof Array) {
                        var $catSel = $(self.portals['item_category']);
                        $.each(data, function (i, o) {
                            $catSel.append(new Option(o['name'], o['id']));
                        });
                    }
                });

                // initialize image drop widget
                $(this.portals['image_drop']).imagedrop({
                    maxFileSize: 8 * 1024 * 1024,
                    onInvalidFile: function (element, file) {
                        util.alert('Please select a valid photo. Accepted image files are JPEG, PNG, or GIF, and are less than 8 MB.', 'Inavlid Photo');
                    },
                    onChange: function(element, file) {
                        console.log("Change: " + ((file) ? (file.name || 'No File Name') : 'None'));
                    }
                });

                $(self.portals['btn_submit']).on('click', function (evt) {
                    var newItem = {
                        title: $(self.portals['item_title']).val(),
                        category: $(self.portals['item_category']).val(),
                        description: $(self.portals['item_desc']).val(),
                        image: $(self.portals['image_drop']).imagedrop('file')
                    };

                    if (!newItem.image) {
                        util.alert('Please select a photo.');
                        return;
                    }

                    if (!newItem.category || '' === newItem.category) {
                        util.alert('Please select a category.');
                        return;
                    }

                    self.disable(true);
                    self._setProgress(0);
                    TSF.newItem(newItem, {
                        progress: function(xhrObj, percent) {
                            self._setProgress(percent);
                        },
                        success: function(data, textStatus, jqXHR) {
                            console.log('Upload complete! :D')
                            console.dir(data);
                        },
                        error: function(jqXHR, textStatus, errorThrown) {
                            util.alert('An error occurred while trying to save the photo. Please try again later.');
                            self.disable(false);
                            self._setProgress(0);
                        }
                    });

                });

                return html;
            },
            _setProgress: function (percent) {
                var self = this,
                    $progBar = $(self.portals['progress_bar']);

                $progBar.find('[role="progressbar"]').css('width', percent + '%').attr('aria-valuenow', percent);
                $progBar.find('span.sr-only').text(percent + '% Complete');

                return self;
            },

            disable: function (bool) {
                var self = this,
                    $imgCont = $(self.portals['image_drop_container']),
                    $userInput = $(self.portals['user_inputs']);

                if (bool) {
                    $imgCont.addClass('upload-in-progress');
                    $userInput.addClass('upload-in-progress');
                } else {
                    $imgCont.removeClass('upload-in-progress');
                    $userInput.removeClass('upload-in-progress');
                }

                return self;
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

        var ItemViewPanel = Segue.Class('ItemViewPanel', {
            base: Segue.Element,
            init: function (itemObj) {
                Segue.Element.call(this, {
                    templateNode: $('#item-view-panel-template').get(0),
                    model: itemObj
                });

                return this;
            },

            dismiss: function () {
                var self = this,
                    $html = $(self.html());

                $html.stop().hide('slow', function () {
                    $html.remove();
                    self.uncacheHtlm();
                });
                return self;
            },

            load: function () {
                var self = this,
                    $html = $(self.html());

                self.container.append($html);
                $html.stop().hide().show('slow');
                return self;
            }
        });

        var PageFactory = function () {
            var cachedPages = {};

            var createMessagePage = function (message) {
                if (cachedPages['messagepage']) {
                    cachedPages['messagepage'].setMessage(message);
                    return cachedPages['messagepage'];
                }

                var msgPage = new SPage('Message Page');
                msgPage.navbar = 'shrink';
                msgPage.showCover = false;

                var msgPanel = new MessagePannel();
                msgPage.setMessage = function (msg) {
                    msgPanel.setMessage(msg);
                };
                msgPage.setMessage(message);
                msgPage.addChildElement(msgPanel);

                cachedPages['messagepage'] = msgPage;
                return msgPage;
            };

            var createLoginPage = function () {
                if (cachedPages['loginpage']) {
                    return cachedPages['loginpage'];
                }

                var loginPage = new SPage('Login Page');
                loginPage.navbar = 'shrink';
                loginPage.showCover = false;
                loginPage.isLoginPage = true;

                loginPage.loadNext = function () {
                    var self = this;
                    if (self.next) {
                        Segue.loadPage(self.next, self.nextUrl);
                    } else {
                        PageFactory.loadHomePage();
                    }
                };

                loginPage.addChildElement(new LoginPanel([
                    {
                        buttonClass: 'gplus-button',
                        displayText: 'Sign in with Goolge',
                        click: function (event) {
                            TSF.googleLogin(function (data) {
                                if (data['error']) {
                                    util.alert('There was an error authenticating the user.');
                                } else {
                                    loginPage.loadNext();
                                }
                            });
                        }
                    },

                    {
                        buttonClass: 'fb-button',
                        displayText: 'Sign in with Facebook',
                        click: function (event) {
                            TSF.facebookLogin(function (data) {
                                if (data['error']) {
                                    util.alert('There was an error authenticating the user.');
                                } else {
                                    loginPage.loadNext();
                                }
                            });
                        }
                    }
                ]));

                cachedPages['loginpage'] = loginPage;
                return loginPage;
            };

            var createLogoutPage = function () {
                if (cachedPages['lougoutpage']) {
                    return cachedPages['lougoutpage'];
                }

                var logoutPage = new SPage('Logout Page');
                logoutPage.navbar = 'shrink';
                logoutPage.showCover = false;
                logoutPage.isLogoutPage = true;

                logoutPage.addChildElement(new MessagePannel('You have singed out.'));

                cachedPages['lougoutpage'] = logoutPage;
                return logoutPage;
            };

            var createUploadPage = function () {
                if (cachedPages['uploadpage']) {
                    return cachedPages['uploadpage'];
                }

                var uploadP = new SPage('Upload Page');
                uploadP.navbar = 'shrink';
                uploadP.showCover = false;
                uploadP.isUploadPage = true;
                uploadP.requireLogin = true;

                uploadP.addChildElement(new UploadPanel());

                cachedPages['uploadpage'] = uploadP;
                return uploadP;
            };

            var createItemViewPage = function () {
                if (cachedPages['viewitem']) {
                    return cachedPages['viewitem'];
                }

                var itemViewPage = new SPage('Item View Page');
                itemViewPage.navbar = 'shrink';
                itemViewPage.showCover = false;

                var bindableItem = Segue.makeObjectBindable({
                    author_id: 0,
                    author: {
                        id: 0,
                        name: '',
                        picture: '',
                    },
                    category_id: 1,
                    category: {
                        id: 0,
                        name: ''
                    },
                    id: 0,
                    date_created: '',
                    description: '',
                    image_url: '',
                    last_modified: '',
                    title: ''
                });

                var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
                bindableItem['displayDate'] = Segue.computed(function () {
                    var d = new Date(bindableItem.date_created());
                    return months[d.getMonth()] + ' ' + d.getDate() + ', ' +  d.getFullYear();
                }, bindableItem).subscribeTo(bindableItem.date_created);

                bindableItem['readOnly'] = Segue.computed(function () {
                    var currentUser = TSF.currentUser();
                    return  !currentUser || (currentUser.id !== bindableItem.author.id());
                }, bindableItem).subscribeTo(bindableItem.author.id);

                var updateValues = function (bindableDist, srcObj) {
                    $.each(bindableDist, function (k, v) {
                        if ('object' === typeof v) {
                            updateValues(v, srcObj[k]);
                        } else {
                            v(srcObj[k]);
                        }
                    });
                };

                itemViewPage.setItem = function (item) {
                    itemViewPage.item = item;
                    updateValues(bindableItem, item);
                };

                itemViewPage.addChildElement(new ItemViewPanel(bindableItem));

                cachedPages['viewitem'] = itemViewPage;
                return itemViewPage;
            };

            var pageLoaders = {
                homepage: function (pageData) {
                    var homePage = new SPage('Home Page');
                    homePage.showCover = true;
                    // var latestPanel = new Panel({
                    //     id: 'latest',
                    //     name: 'Latest Shots'
                    // });
                    // homePage.addChildElement(latestPanel);
                    TSF.getCategories(function (categories) {
                        $.each(categories, function (i, o) {
                            var panelObj = new Panel(o);
                            homePage.addChildElement(panelObj);
                            TSF.getItemsForCat(o['id'], function (data) {
                                if (!data['error'] && data instanceof Array) {
                                    $.each(data, function (itemI, itemO) {
                                        panelObj.newItemArrived(new ItemEntry(itemO));
                                    });
                                }
                            });
                        });
                        Segue.loadPage(homePage, '/');
                    });
                },

                loginpage: function (pageData) {
                    Segue.loadPage(createLoginPage());
                },

                logoutpage: function (pageData) {
                    TSF.logout(function () {
                        Segue.loadPage(createLogoutPage(), '/pages/logout/')
                    });
                },

                uploadpage: function (pageData) {
                    Segue.loadPage(createUploadPage(), '/pages/item/new/');
                },

                viewitem: function (pageData) {
                    TSF.getItem(pageData.id, function (itemObj) {
                        if (itemObj && !itemObj['error']) {
                            var viPage = createItemViewPage();
                            viPage.setItem(itemObj);
                            Segue.loadPage(viPage, '/pages/item/' + itemObj.id + '/');
                        } else {
                            Segue.loadPage(createMessagePage('Item not found.'), '/pages/item/' + itemObj.id + '/');
                        }
                    });
                }
            };

            Segue.on('pageLoad', function (pageObj) {
                if (pageObj.isLoginPage || pageObj.requireLogin) {
                    TSF.hasActiveUser(function (isSignedIn) {
                        if (pageObj.isLoginPage && isSignedIn && pageObj.loadNext) {
                            pageObj.loadNext();
                            return;
                        }

                        if (pageObj.requireLogin && !isSignedIn) {
                            var lp = createLoginPage();
                            lp.next = pageObj;
                            lp.nextUrl = d.location.pathname;
                            Segue.loadPage(lp, '/pages/login/');
                            return;
                        }
                    });
                }
            });

            return {
                loadPageForData: function (data) {
                    if (pageLoaders[data['pagetype']]) {
                        pageLoaders[data['pagetype']](data);
                    } else {
                        util.alert('Ivalid page data. Please contact administrator.');
                    }
                },

                loadHomePage: function () {
                    pageLoaders['homepage']();
                },

                loadLoginPage: function () {
                    var curPage = Segue['storybook']['currentPage'],
                        loginPage = createLoginPage();

                    loginPage.next = (curPage
                        && !curPage.isLogoutPage
                        && !curPage.isLoginPage
                        && curPage !== loginPage) ?
                            curPage : false;

                    loginPage.nextUrl = d.location.pathname;

                    Segue.loadPage(loginPage, '/pages/login/');
                },

                loadLogoutPage: function () {
                    pageLoaders['logoutpage']();
                },

                loadUploadPage: function () {
                    pageLoaders['uploadpage']();
                },

                loadViewItemPage: function (itemObj) {
                    var viPage = createItemViewPage();
                    viPage.setItem(itemObj);
                    Segue.loadPage(viPage, '/pages/item/' + itemObj.id + '/')
                }
            };
        }();
        

        // Commence Data Loading

        // Setup navigation bar
        var navBar = new NavBar();
        navBar.setActionFor('login', function () {
           PageFactory.loadLoginPage();
        })

        navBar.setActionFor('logout', function () {
           PageFactory.loadLogoutPage();
        })

        navBar.setActionFor('upload', function () {
            PageFactory.loadUploadPage();
        });

        // Get Current user
        TSF.getSignedInUser(function (user) {
            if (user['name'] && user['picture']) {
                Segue.fireEvent('userevent');
            }
        });

        // Get page data
        TSF.getDataForPage(function (data) {
            if (data['error']) {
                util.alert('An error occurred while retrieving data. Please reload page.');
            } else {
                Segue.one('pageWillLoad', function () {
                    $('#body-content').empty();
                });
                PageFactory.loadPageForData(data);
            }
        });

        // Get images for the page cover
        TSF.getFeatured(function (data) {
            var pageCover = new Cover();
            if (data instanceof Array) {
                // Load only 1 image first
                var img1 = data.pop();
                if (img1) {
                    pageCover.addImage(img1)
                }

                // Load all other images 6 seconds later
                //      to yeild bandwith to other page data
                setTimeout(function () {
                    $.each(data, function (i, o) {
                        pageCover.addImage(o);
                    });
                }, 6000);
            }
        });




        // Instantiations
        // var asiaPanel = {
        //     title: Segue.bindable('Asia Town'),
        //     items: [
        //         {image_url: 'http://i.imgur.com/bwy74ok.jpg'},
        //         {image_url: 'http://i.imgur.com/bAZWoqx.jpg'},
        //         {image_url: 'http://i.imgur.com/PgmEBSB.jpg'},
        //         {image_url: 'http://i.imgur.com/aboaFoB.jpg'},
        //         {image_url: 'http://i.imgur.com/LkmcILl.jpg'},
        //         {image_url: 'http://i.imgur.com/q9zO6tw.jpg'},
        //         {image_url: 'http://i.imgur.com/r8p3Xgq.jpg'},
        //         {image_url: 'http://i.imgur.com/hODreXI.jpg'},
        //         {image_url: 'http://i.imgur.com/UORFJ3w.jpg'}
        //     ]
        // };
        // w['asiaPanel'] = asiaPanel;

        // var navBar = new NavBar();
        // w['navBar'] = navBar;

        // var pageCover = new Cover();
        // // TODO: Load only first image.
        // //          load suceeding images 5 seconds later
        // //          to allow the rest of the page to load first
        // pageCover.addImage('/static/images/cover_1.jpg');
        // pageCover.addImage('/static/images/cover_2.jpg');
        // pageCover.addImage('/static/images/cover_3.jpg');

        // var homePage = new SPage('Home Page');
        // homePage.showCover = true;
        // homePage.addChildElement(new Panel(asiaPanel));
        // homePage.addChildElement(new Panel(asiaPanel));

        // //$('#body-content').empty();
        // //Segue.loadPage(homePage);
        // w['myHomePage'] = homePage;

        // Login Page
        // var loginPage = new SPage('Login Page');
        // loginPage.navbar = 'shrink';
        // loginPage.showCover = false;
        // loginPage.isLoginPage = true;
        // loginPage.addChildElement(new LoginPanel([
        //     {
        //         buttonClass: 'gplus-button',
        //         displayText: 'Sign in with Goolge',
        //         click: function (event) {
        //             console.log('Do goggle login here');
        //             TSF.googleLogin(function (data) {
        //                 // TODO: Check for login error
        //                 console.log('Google login complete.');
        //                 console.dir(data);
        //             });
        //         }
        //     },

        //     {
        //         buttonClass: 'fb-button',
        //         displayText: 'Sign in with Facebook',
        //         click: function (event) {
        //             console.log('Do facebook login here');
        //             // TODO: Check for login error
        //             TSF.facebookLogin(function (data) {
        //                 console.log('Facebook login complete.');
        //                 console.dir(data);
        //             });
        //         }
        //     }
        // ]));

        // navBar.setActionFor('login', function () {
        //     var curPage = Segue['storybook']['currentPage'];
        //     loginPage.next = (curPage && curPage !== loginPage) ? curPage : false;
        //     Segue.loadPage(loginPage, '/pages/login/');
        // })


        // // Upload Page
        // var uploadPage = new SPage('Upload Page');
        // uploadPage.navbar = 'grow';
        // uploadPage.showCover = true;

        // navBar.setActionFor('upload', function () {
        //     Segue.loadPage(uploadPage, '/pages/upload/');
        // })


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


