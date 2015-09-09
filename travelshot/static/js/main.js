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

            simpleGet: function (url, callback, includeCsrf) {
                var funcCallback = _utils.functionify(callback);

                $.ajax({
                    type: 'GET',
                    url: url,
                    headers: (includeCsrf) ? {'X-CSRFToken': APP_GLOBALS.get('csrfToken')} : {},
                    dataType: 'json',
                    success: function(data, textStatus, jqXHR) {
                        funcCallback(data);
                    },
                    error: function(jqXHR, textStatus, errorThrown) {
                        _utils.errorHanlder(jqXHR, textStatus, errorThrown, funcCallback);
                    }
                });
            },

            _categoriesCache: false
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
            var callbackwrapper = function (data) {
                if (data && !data['error']) {
                    util._categoriesCache = data ;
                }

                if ('function' === typeof callback) {
                    callback(data);
                }
            };

            if (util._categoriesCache) {
                if ('function' === typeof callback) {
                    callback(util._categoriesCache);
                }
            } else {
                util.simpleGet('/api/categories/', callbackwrapper);
            }
        },

        // TODO: remove this function
        getItemsForCat: function (catId, callback) {
            util.simpleGet('/api/items/' + catId + '/', callback);
        },

        getCategoryItems: function (catId, callback) {
            util.simpleGet('/api/category/' + catId + '/items/', callback);
        },

        getLatestItems: function (callback) {
            util.simpleGet('/api/items/latest/', callback);
        },

        getMyItems: function (callback) {
            util.simpleGet('/api/myitems/', callback, true);
        },

        newItem: function (itemObj, callbacks) {
            var ajaxUpload = new AjaxUpload($.extend({
                resizeImageOnSize: 256 * 1024,
                headers: {'X-CSRFToken': APP_GLOBALS.get('csrfToken')}
            }, callbacks));

            ajaxUpload.submit('/api/item/new/', $.extend({}, itemObj));
        },

        editItem: function (itemObj, callbacks) {
            var ajaxUpload = new AjaxUpload($.extend({
                resizeImageOnSize: 256 * 1024,
                headers: {'X-CSRFToken': APP_GLOBALS.get('csrfToken')}
            }, callbacks));

            ajaxUpload.submit('/api/item/' + itemObj.item_id + '/edit/', $.extend({}, itemObj));
        },

        getItem: function (id, callback) {
            util.simpleGet('/api/item/' + id + '/', callback);
        },

        requestDeleteItem: function (id, callback) {
            util.simpleGet('/api/item/' + id + '/delete/', callback, true);
        },

        deleteItem: function (id, nonceToken, callbacks) {
            var ajaxUpload = new AjaxUpload($.extend({
                headers: {'X-CSRFToken': APP_GLOBALS.get('csrfToken')},
                contentType: 'application/json'
            }, callbacks));

            ajaxUpload.submit('/api/item/' + id + '/delete/', {
                nonce_token: nonceToken
            });
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
                },

                flashMessage: function (message, type) {
                    var msgBox = $('#flash-message'),
                        duration = ('error' === type) ? 6000: 3000;
                    if ('error' === type) {
                        msgBox.addClass('flash-msg-error');
                    } else {
                        msgBox.removeClass('flash-msg-error');
                    }
                    msgBox.text(message).stop(true, true).show().fadeOut(duration);
                },

                createBindableItemObj: function () {
                    var bindableItem = Segue.makeObjectBindable({
                        author: {id: 0, name: '', picture: ''},
                        category: {id: 0, name: ''},
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

                    bindableItem['categoryUrl'] = Segue.computed(function () {
                        return '/pages/category/' + bindableItem.category.id() + '/items/';
                    }, bindableItem).subscribeTo(bindableItem.category.id);

                    bindableItem['editUrl'] = Segue.computed(function () {
                        return '/pages/item/' + bindableItem.id() + '/edit/';
                    }, bindableItem).subscribeTo(bindableItem.id);

                    bindableItem['deleteUrl'] = Segue.computed(function () {
                        return '/pages/item/' + bindableItem.id() + '/delete/';
                    }, bindableItem).subscribeTo(bindableItem.id);

                    return bindableItem;
                },

                updateBindableValues: function (bindableDist, srcObj) {
                    $.each(bindableDist, function (k, v) {
                        if ('object' === typeof v) {
                            util.updateBindableValues(v, srcObj[k]);
                        } else if ('function' === typeof v) {
                            v(srcObj[k]);
                        } else {
                            bindableDist[k] = srcObj[k];
                        }
                    });

                    return bindableDist;
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
                    $(btn).find('>a:first-of-type').on('click', function (event) {
                        if ('function' === typeof self.clickActions[key]) {
                            event.preventDefault();
                            self.clickActions[key](event);
                        }
                    });
                };
                setBtnAct(self.portals['upload_button'], 'upload');
                setBtnAct(self.portals['login_button'], 'login');
                setBtnAct(self.portals['logout_button'], 'logout');
                setBtnAct(self.portals['my_shots_button'], 'myshots');
                setBtnAct(self.portals['home_button'], 'home');

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

        var Footer = Segue.Class('Footer', {
            base: Segue.Element,
            init : function () {
                Segue.Element.call(this, {
                    templateNode: $('#page-footer').get(0),
                    model: {}
                });

                var self = this;

                Segue.on('pageLoad', function (pageObj) {
                    self.pageWantsFooter = !pageObj.hideFooter;
                    self.updateDisplay();
                });

                return this;
            },

            updateDisplay: function () {
                var self = this,
                    $html = $(self.html());

                if (self.pageWantsFooter) {
                    $html.removeClass('footer-hidden');
                } else {
                    $html.addClass('footer-hidden');
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
                var self = this,
                    $html = $(self.html());
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
        
        // TODO: Delete this class
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
                    self.uncacheHtml();
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

        var CategoryPanel = Segue.Class('CategoryPanel', {
            base: Segue.Element,
            init: function (categoryObj) {
                var bindableCategory = {
                    category: {
                        id: Segue.bindable(''),
                        name: Segue.bindable('')    
                    },
                    hasItems: Segue.bindable(false)
                };

                bindableCategory.hasNoItems = Segue.computed(function () {
                    return !bindableCategory.hasItems();
                }).subscribeTo(bindableCategory.hasItems);

                bindableCategory.feedUrl = Segue.computed(function () {
                    var catId = bindableCategory.category.id();
                    return ('latestitems' === catId) 
                                ? '/atom/latestitems.atom'
                                : '/atom/category/' + catId + '/latestitems.atom';
                }).subscribeTo(bindableCategory.category.id);

                bindableCategory.hideRss = Segue.computed(function () {
                    return 'myitems' ===  bindableCategory.category.id();
                }).subscribeTo(bindableCategory.category.id);

                Segue.Element.call(this, {
                    templateNode: $('#category-panel-template').get(0),
                    model: bindableCategory
                });

                if (categoryObj) {
                    this.setCategory(categoryObj);
                }

                this._isLoaded = false;
                this.absolutify = true;

                return this;
            },

            setCategory: function (categoryObj) {
                this.category = categoryObj;
                util.updateBindableValues(this.options.model.category, categoryObj);
                return this;
            },

            setItems: function (itemObjArr) {
                var self = this,
                    $html = $(self.html()),
                    $grid = $(self.portals['item_list']);

                self.items = itemObjArr;
                self.options.model.hasItems(self.items.length > 0);

                if (self._isLoaded) {
                    $.each(self.elements, function (i, o) {
                        o.dismiss();
                    })
                }
                $grid.isotope('layout');

                self.elements = [];
                $.each(itemObjArr, function (i, o) {
                    var itemEntry = new ItemEntry(o);
                    self.addChildElement(itemEntry);
                    
                    itemEntry.isotopeGrid = $grid;
                    if (self._isLoaded) {
                        itemEntry.load();
                    }
                });

                return self;
            },

            html: function () {
                if (this.cachedHtml) {
                    return this.cachedHtml;
                }

                var html = Segue.Element.prototype.html.call(this),
                    self = this,
                    $categories = $(self.portals['category_list']),
                    $footer = $(self.portals['category_footer']);

                if (!self.absolutify) {
                    $(html).filter('div.category-panel').removeClass('category-panel-absolute');
                }

                var appendItemToList = function (category_id, text, url, action, addToFooter) {
                    var createAnchor = function () {
                        var anchorTag = d.createElement('a');
                        anchorTag.href = url;
                        anchorTag.text = text;
                        $(anchorTag).on('click', function (evt) {
                            evt.preventDefault();
                            action();
                        });
                        return anchorTag;
                    };

                    var createListTag = function (setActive) {
                        var $listTag = $(d.createElement('li'));
                        $listTag.append(createAnchor());
                        if (setActive) {
                            if (self.category && self.category.id === category_id) {
                                $listTag.addClass('active');
                            }
                        }
                        return $listTag;
                    };

                    // Menu item
                    $categories.append(createListTag(true));

                    // Footer item
                    if (addToFooter) {
                        $footer.find('ul').append(createListTag(false));
                    }
                };

                appendItemToList('latestitems', 'Latest Shots', '/pages/latestitems/', function () {
                    PageFactory.loadLatestItemsPage();
                });

                appendItemToList('myitems', 'My Shots', '/pages/myitems/', function () {
                    PageFactory.loadMyItemsPage();
                });

                $categories.append($('<li role="separator" class="divider"></li>'));
                $categories.append($('<li class="dropdown-header">Categories</li>'));

                // Get Item categories
                TSF.getCategories(function (data) {
                    if (!data['error'] && data instanceof Array) {
                        $.each(data, function (i, o) {
                            var url =  '/pages/category/' + o['id'] + '/items/'
                            appendItemToList(o['id'], o['name'], url, function () {
                                PageFactory.loadCategoryPage(o);
                            }, true);
                        });
                    }
                });
                
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

                self._isLoaded = false

                $.each(self.elements, function (i, o) {
                    o.dismiss();
                });

                $html.stop().fadeOut('slow', function () {
                    $html.remove();
                    self.uncacheHtml();
                });
                return self;
            },

            load: function () {
                var self = this,
                    $html = $(self.html()),
                    $grid = $(self.portals['item_list']);

                self.container.append($html);
                $html.stop().hide().fadeIn('slow', function () {
                    $grid.isotope('layout');
                    $.each(self.elements, function (i, o) {
                        o.isotopeGrid = $grid;
                        o.load();
                    });
                    self._isLoaded = true
                });
                return self;
            }
        });

        var ItemEntry = Segue.Class('ItemEntry', {
            base: Segue.Element,
            init: function (itemObj) {
                Segue.Element.call(this, {
                    templateNode: $('#grid-item-template').get(0),
                    model: $.extend({}, itemObj, {'page_url': '/pages/item/' + itemObj.id + '/'})
                });
                return this;
            },

            html: function () {
                if (this.cachedHtml) {
                    return this.cachedHtml;
                }

                var html = Segue.Element.prototype.html.call(this),
                    self = this;

                $(html).find('> a').on('click', function (evt) {
                    evt.preventDefault();
                    PageFactory.loadViewItemPage(self.options.model);
                });

                return html;
            },

            dismiss: function () {
                var self = this;
                if (self.isotopeGrid) {
                    self.isotopeGrid.isotope('remove', $(self.html()));
                    self.uncacheHtml();
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
                    self.uncacheHtml();
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
                    self.uncacheHtml();
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
                    self.uncacheHtml();
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
            init: function (itemObj) {
                var modelRef = {
                    isNewItem: Segue.bindable(true)
                };

                Segue.Element.call(this, {
                    templateNode: $('#upload-panel-template').get(0),
                    model: modelRef
                });

                this.photoHasChanged = false;
                this.isEditing = false;
                this.modelRef = modelRef;

                if (itemObj) {
                    this.setItem(itemObj);
                }
                return this;
            },

            setItem: function (itemObj) {
                var self = this;

                self.item = itemObj;
                self._updateFields();

                return self;
            },

            clearItem: function () {
                var self = this;

                delete self.item;
                self._updateFields();

                return self;
            },

            _updateFields: function () {
                var self = this,
                    $html = $(self.html());

                if (self.item) {
                    self.photoHasChanged = false;
                    self.isEditing = true;
                    self.modelRef.isNewItem(false);

                    $(self.portals['item_title']).val(self.item.title);
                    $(self.portals['item_category']).val(self.item.category.id);
                    $(self.portals['item_desc']).val(self.item.description);
                    $(self.portals['image_drop']).imagedrop('displayImageUrl', self.item.image_url);
                } else {
                    self.photoHasChanged = false;
                    self.isEditing = false;
                    self.modelRef.isNewItem(true);

                    $(self.portals['item_title']).val('');
                    $(self.portals['item_category']).val('');
                    $(self.portals['item_desc']).val('');
                    $(self.portals['image_drop']).imagedrop('clearFile');
                }
            },

            html: function () {
                if (this.cachedHtml) {
                    return this.cachedHtml;
                }

                var html = Segue.Element.prototype.html.call(this);

                var self = this;

                self.photoHasChanged = false;

                // Get Item categories
                TSF.getCategories(function (data) {
                    if (!data['error'] && data instanceof Array) {
                        var $catSel = $(self.portals['item_category']);
                        $.each(data, function (i, o) {
                            $catSel.append(new Option(o['name'], o['id']));
                        });
                        if (self.item) {
                            $catSel.val(self.item.category.id);
                        }
                    }
                });

                // initialize image drop widget
                $(this.portals['image_drop']).imagedrop({
                    maxFileSize: 8 * 1024 * 1024,
                    onInvalidFile: function (element, file) {
                        util.alert('Please select a valid photo. Accepted image files are JPEG, PNG, or GIF, and are less than 8 MB.', 'Inavlid Photo');
                    },
                    onChange: function(element, file) {
                       self.photoHasChanged = true;
                    }
                });

                var _readAndValidate = function () {
                    var title = $(self.portals['item_title']).val().trim(),
                        category = $(self.portals['item_category']).val(),
                        description =  $(self.portals['item_desc']).val().trim(),
                        image = $(self.portals['image_drop']).imagedrop('file');

                    // require photo if adding new item
                    if (!self.isEditing && !image) {
                        util.flashMessage('Please select a photo.');
                        return false;
                    }

                    if (!title || '' === title) {
                        util.flashMessage('What is title of this photo?');
                        return false;
                    }

                    if (!category || '' === category) {
                        util.flashMessage('Please select a category.');
                        return false;
                    }

                    var item = {
                        title: title,
                        category: category,
                        description: description
                    };

                    if (image) {
                        item['image'] = image;
                    }

                    return item;
                };

                var _callbackOptions = {
                    progress: function(xhrObj, percent) {
                        self._setProgress(percent);
                    },

                    success: function(data, textStatus, jqXHR) {
                        util.flashMessage('Saved!');
                        PageFactory.loadViewItemPage(data);
                    },

                    error: function(jqXHR, textStatus, errorThrown) {
                        var errMsg = (jqXHR.responseJSON && jqXHR.responseJSON.error && jqXHR.responseJSON.error.description) ?
                                'ERROR: ' + jqXHR.responseJSON.error.description :
                                'An error occurred while trying to save the item. Please try again later.';

                        util.flashMessage(errMsg, 'error');
                        self.disable(false);
                        self._setProgress(0);
                    }
                };

                $(self.portals['btn_submit']).on('click', function (evt) {
                    self.disable(true);
                    self._setProgress(0);

                    var updatedItem = _readAndValidate();
                    if (updatedItem) {
                        if (self.isEditing) {
                            TSF.editItem($.extend({item_id: self.item.id}, updatedItem), _callbackOptions);
                        } else {
                            TSF.newItem(updatedItem, _callbackOptions);
                        }
                    } else {
                        self.disable(false);
                        self._setProgress(0);
                    }
                });

                $(self.portals['btn_cancel']).on('click', function (evt) {
                    PageFactory.loadViewItemPage(self.item);
                });

                $(self.portals['btn_delete']).on('click', function (evt) {
                    PageFactory.loadDeleteItemPage(self.item);
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
                    self.uncacheHtml();
                });
                return self;
            },

            load: function () {
                var self = this,
                    $html = $(self.html());

                self._updateFields();
                self.container.append($html);
                $html.stop().hide().slideDown('slow');
                return self;
            }
        });

        var ItemViewPanel = Segue.Class('ItemViewPanel', {
            base: Segue.Element,
            init: function (itemObj) {
                var bindableItem = util.createBindableItemObj();
                Segue.Element.call(this, {
                    templateNode: $('#item-view-panel-template').get(0),
                    model: bindableItem
                });

                if (itemObj) {
                    this.setItem(itemObj);
                }

                return this;
            },

            setItem: function (itemObj) {
                this.item = itemObj;
                util.updateBindableValues(this.options.model, itemObj);
                return this;
            },

            html: function () {
                if (this.cachedHtml) {
                    return this.cachedHtml;
                }
                var html = Segue.Element.prototype.html.call(this);

                var self = this;

                $(self.portals['edit_button']).on('click', function (evt) {
                    evt.preventDefault();
                    PageFactory.loadEditItemPage(self.item);
                });

                $(self.portals['delete_button']).on('click', function (evt) {
                    evt.preventDefault();
                    PageFactory.loadDeleteItemPage(self.item);
                });

                $(self.portals['category_button']).on('click', function (evt) {
                    evt.preventDefault();
                    PageFactory.loadCategoryPage({id: self.item.category.id});
                });

                return html;
            },

            dismiss: function () {
                var self = this,
                    $html = $(self.html());

                $html.stop().slideUp('slow', function () {
                    $html.remove();
                    self.uncacheHtml();
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

        var ItemDeletePanel = Segue.Class('ItemDeletePanel', {
            base: Segue.Element,
            init: function (itemObj) {
                var bindableItem = util.createBindableItemObj();
                Segue.Element.call(this, {
                    templateNode: $('#item-delete-panel-template').get(0),
                    model: bindableItem
                });

                if (itemObj) {
                    this.setItem(itemObj);
                }

                return this;
            },

            html: function () {
                if (this.cachedHtml) {
                    return this.cachedHtml;
                }
                var html = Segue.Element.prototype.html.call(this);

                var self = this;

                $(self.portals['btn_cancel']).on('click', function (evt) {
                    PageFactory.loadViewItemPage(self.item);
                });

                $(self.portals['btn_delete']).on('click', function (evt) {
                    TSF.deleteItem(self.item.id, self.nonceToken, {
                        success: function(data, textStatus, jqXHR) {
                            util.flashMessage('Item deleted!');
                            // TODO: Load Myshots page
                            PageFactory.loadHomePage();
                        },
                        error: function(jqXHR, textStatus, errorThrown) {
                            var errMsg = (jqXHR.responseJSON && jqXHR.responseJSON.error && jqXHR.responseJSON.error.description) ?
                                    'ERROR: ' + jqXHR.responseJSON.error.description :
                                    'An error occurred while trying to delete the item. Please try again later.';

                            util.flashMessage(errMsg, 'error');
                        }
                    });
                });

                return html;
            },

            setItem: function (itemObj) {
                this.item = itemObj;
                util.updateBindableValues(this.options.model, itemObj);
                return this;
            },

            setNonceToken: function (token) {
                this.nonceToken = token;
                return this;
            },

            dismiss: function () {
                var self = this,
                    $html = $(self.html());

                $html.stop().slideUp('slow', function () {
                    $html.remove();
                    self.uncacheHtml();
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

        var PageFactory = function () {
            var cachedPages = {};

            var cachablePage = function (pagetype, creation, beforeReturningCache) {
                return function () {
                    if (cachedPages[pagetype]) {
                        if (beforeReturningCache) {
                            beforeReturningCache.apply(cachedPages[pagetype], arguments);
                        }
                        return cachedPages[pagetype];
                    }

                    cachedPages[pagetype] = creation.apply(this, arguments);

                    return cachedPages[pagetype];
                };
            };

            var keyedCachablePage = function (pagetype, creation, beforeReturningCache) {
                return function (key) {
                    var pageCreator = cachablePage(pagetype + '_' + key, creation, beforeReturningCache);
                    return pageCreator.apply(this, Array.prototype.slice.call(arguments, 1));
                } 
            };

            var createMessagePage = cachablePage('messagepage', function (message) {
                var msgPage = new SPage('Message Page');
                msgPage.navbar = 'shrink';
                msgPage.showCover = false;

                var msgPanel = new MessagePannel();
                msgPage.setMessage = function (msg) {
                    msgPanel.setMessage(msg);
                };
                msgPage.setMessage(message);
                msgPage.addChildElement(msgPanel);

                return msgPage;
            }, function (message) {
                this.setMessage(message);
            });

            var createLoginPage = cachablePage('loginpage', function () {
                var loginPage = new SPage('Login Page');
                loginPage.navbar = 'shrink';
                loginPage.showCover = false;
                loginPage.isLoginPage = true;

                loginPage.loadNext = function () {
                    var self = this;
                    if (self.next) {
                        if ('function' === typeof self.next) {
                            self.next();
                        } else {
                            Segue.loadPage(self.next, self.nextUrl);
                        }
                    } else {
                        PageFactory.loadHomePage();
                    }
                };

                var googleButton = {
                    buttonClass: 'gplus-button',
                    displayText: 'Sign in with Goolge',
                    click: function (event) {
                        TSF.googleLogin(function (data) {
                            if (data['error']) {
                                util.flashMessage('There was an error authenticating the user.', 'error');
                            } else {
                                loginPage.loadNext();
                            }
                        });
                    }
                };

                var facebookButton = {
                    buttonClass: 'fb-button',
                    displayText: 'Sign in with Facebook',
                    click: function (event) {
                        TSF.facebookLogin(function (data) {
                            if (data['error']) {
                                util.flashMessage('There was an error authenticating the user.', 'error');
                            } else {
                                loginPage.loadNext();
                            }
                        });
                    }
                };

                loginPage.addChildElement(new LoginPanel([googleButton, facebookButton]));
                return loginPage;
            });

            var createLogoutPage = cachablePage('lougoutpage', function () {
                var logoutPage = new SPage('Logout Page');
                logoutPage.navbar = 'shrink';
                logoutPage.showCover = false;
                logoutPage.isLogoutPage = true;

                logoutPage.addChildElement(new MessagePannel('You have singed out.'));

                return logoutPage;
            });

            var createUploadPage = cachablePage('uploadpage', function () {
                var uploadP = new SPage('Upload Page'),
                    panelEl = new UploadPanel();

                uploadP.navbar = 'shrink';
                uploadP.showCover = false;
                uploadP.isUploadPage = true;
                uploadP.requireLogin = true;

                uploadP.setItem = function (itemObj) {
                    uploadP.item = itemObj;
                    panelEl.setItem(itemObj);
                    return uploadP;
                };

                uploadP.clearItem = function () {
                    delete uploadP.item;
                    panelEl.clearItem();
                    return uploadP;
                };

                uploadP.addChildElement(panelEl);
                return uploadP
            });

            var createItemViewPage = cachablePage('viewitempage', function () {
                var itemViewPage = new SPage('Item View Page');
                itemViewPage.navbar = 'shrink';
                itemViewPage.showCover = false;

                var itemPanelObj = new ItemViewPanel();

                itemViewPage.setItem = function (item) {
                    itemViewPage.item = item;
                    itemPanelObj.setItem(item);
                    return itemViewPage;
                };

                itemViewPage.addChildElement(itemPanelObj);

                return itemViewPage;
            });

            var createDeleteItemPage = cachablePage('deleteitempage', function () {
                var itemDeletePage = new SPage('Item Delete Page');
                itemDeletePage.navbar = 'shrink';
                itemDeletePage.showCover = false;
                itemDeletePage.requireLogin = true;

                var deletePanel = new ItemDeletePanel();

                itemDeletePage.setItem = function (item) {
                    itemDeletePage.item = item;
                    deletePanel.setItem(item);
                    return itemDeletePage;
                };

                itemDeletePage.setNonceToken = function (token) {
                    itemDeletePage.nonceToken = token;
                    deletePanel.setNonceToken(token);
                    return itemDeletePage;
                };

                itemDeletePage.addChildElement(deletePanel);

                return itemDeletePage;
            });

            var createCategoryPage = keyedCachablePage('categorypage', function () {
                var categoryPage = new SPage('Category Page');
                categoryPage.navbar = 'shrink';
                categoryPage.showCover = false;
                categoryPage.hideFooter = true;

                var categoryPanel = new CategoryPanel();

                categoryPage.setCategory = function (categoryObj) {
                    this.category = categoryObj;
                    categoryPanel.setCategory(categoryObj);
                };

                categoryPage.setItems = function (itemObjArr) {
                    this.items = itemObjArr;
                    categoryPanel.setItems(itemObjArr);
                };

                categoryPage.addChildElement(categoryPanel);

                return categoryPage;
            });

            var createHomePage = cachablePage('homepage', function () {
                var homePage = new SPage('Home Page');
                homePage.showCover = true;

                var latestItems = new CategoryPanel({
                    id: 'latestitems',
                    name: 'Latest Shots'
                });
                latestItems.absolutify = false;

                homePage.setItems = function (itemObjArr) {
                    this.items = itemObjArr;
                    latestItems.setItems(itemObjArr);
                };

                homePage.addChildElement(latestItems);

                return homePage;
            });

            var pageLoaders = {
                homepage: function (pageData) {
                    TSF.getLatestItems(function (data) {
                        if (data && !data['error']) {
                            var homePage = createHomePage();
                            homePage.setItems(data);
                            Segue.loadPage(homePage, '/');
                        } else {
                            Segue.loadPage(createMessagePage('An error occurred. Please try again later.'), '/');
                        }
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
                    var uploadpage = createUploadPage();
                    uploadpage.clearItem();
                    Segue.loadPage(uploadpage, '/pages/item/new/');
                },

                viewitempage: function (pageData, item) {
                    var doLoadViewItemPage = function (itemObj) {
                        var viPage = createItemViewPage();
                        viPage.setItem(itemObj);
                        Segue.loadPage(viPage, '/pages/item/' + itemObj.id + '/');
                    };

                    if (item) {
                        doLoadViewItemPage(item);
                    } else {
                        TSF.getItem(pageData.id, function (itemObj) {
                            if (itemObj && !itemObj['error']) {
                                doLoadViewItemPage(itemObj);
                            } else {
                                Segue.loadPage(createMessagePage('Item not found.'), '/pages/item/' + pageData.id + '/');
                            }
                        });
                    }
                },

                edititempage: function (pageData, item) {

                    var editThisItem = function (itemObj) {
 
                        var doLoadEditPage = function () {
                            if (itemObj.author.id === TSF.currentUser().id) {
                                var edtItmPage = createUploadPage();
                                edtItmPage.setItem(itemObj);
                                Segue.loadPage(edtItmPage, '/pages/item/' + itemObj.id + '/edit/');
                            } else {
                                var viPage = createItemViewPage();
                                viPage.setItem(itemObj);
                                Segue.loadPage(viPage, '/pages/item/' + itemObj.id + '/');
                                util.flashMessage('You don\'t have access to edit this item.', 'error');
                            }
                        };

                        TSF.hasActiveUser(function (isSignedIn) {
                            if (!isSignedIn) {
                                var loginPage = createLoginPage();
                                loginPage.next = function () {
                                    doLoadEditPage();
                                };
                                Segue.loadPage(loginPage, '/pages/login/');
                                util.flashMessage('Sign in to edit this item.');
                            } else {
                                doLoadEditPage();
                            }
                        });
                    };

                    if (item) {
                        editThisItem(item);
                    } else {
                        TSF.getItem(pageData.id, function (itemObj) {
                            if (itemObj && !itemObj['error']) {
                                editThisItem(itemObj);
                            } else {
                                Segue.loadPage(createMessagePage('Item not found.'), '/pages/item/' + pageData.id + '/edit/');
                            }
                        });
                    }
                },

                deleteitempage: function (pageData, item) {
                    var confirmDelete = function (itemObj) {
                        var doLoadDeletePage = function () {
                            TSF.requestDeleteItem(itemObj.id, function (response) {
                                if (response['nonce_token']) {
                                    var delItmPage = createDeleteItemPage();
                                    delItmPage.setItem(itemObj);
                                    delItmPage.setNonceToken(response['nonce_token']);
                                    Segue.loadPage(delItmPage, '/pages/item/' + itemObj.id + '/delete/');
                                } else {
                                    var errCode = (response['error']) ? response['error']['code'] : -1;
                                    if (404 === errCode) {
                                        Segue.loadPage(createMessagePage('Item not found.'), '/pages/item/' + itemObj.id + '/delete/');
                                    } else if (401 === errCode) {
                                        var viPage = createItemViewPage();
                                        viPage.setItem(itemObj);
                                        Segue.loadPage(viPage, '/pages/item/' + itemObj.id + '/');
                                        util.flashMessage('You are not authorized to delete this item.', 'error');
                                    } else {
                                        Segue.loadPage(createMessagePage('Item cannot be deleted.'), '/pages/item/' + itemObj.id + '/delete/');
                                    }
                                }
                            });
                        };

                        TSF.hasActiveUser(function (isSignedIn) {
                            if (!isSignedIn) {
                                var loginPage = createLoginPage();
                                loginPage.next = function () {
                                    doLoadDeletePage();
                                };
                                Segue.loadPage(loginPage, '/pages/login/');
                                util.flashMessage('Sign in to confirm deleting this item.');
                            } else {
                                doLoadDeletePage();
                            }
                        });
                    };

                    if (item) {
                        confirmDelete(item);
                    } else {
                        TSF.getItem(pageData.id, function (itemObj) {
                            if (itemObj && !itemObj['error']) {
                                confirmDelete(itemObj);
                            } else {
                                Segue.loadPage(createMessagePage('Item not found.'), '/pages/item/' + pageData.id + '/delete/');
                            }
                        });
                    }
                },

                categorypage: function (pageData) {
                    TSF.getCategoryItems(pageData.id, function (data) {
                        if (data && !data['error']) {
                            var categoryPage = createCategoryPage(pageData.id);
                            categoryPage.setCategory(data['category']);
                            categoryPage.setItems(data['items']);
                            Segue.loadPage(categoryPage, '/pages/category/' + data['category']['id'] + '/items/');
                        } else {
                            var errCode = (data['error']) ? data['error']['code'] : -1,
                                defaultErrMsg = 'An error occurred. Please try again later.',
                                errDesc = (data['error']) ? data['error']['description'] || defaultErrMsg : defaultErrMsg;
                            if (404 === errCode) {
                                Segue.loadPage(createMessagePage('Category not found.'), '/pages/category/' + pageData.id + '/items/');
                            } else {
                                Segue.loadPage(createMessagePage(errDesc), '/pages/category/' + pageData.id + '/items/');
                            }
                        }
                    });
                },

                myitemspage: function (pageData) {
                    var doLoadMyItems = function () {
                        TSF.getMyItems(function (data) {
                            if (data && !data['error']) {
                                var categoryObj = {
                                    id: 'myitems',
                                    name: 'My Shots'
                                };

                                var myItemsPage = createCategoryPage(categoryObj.id);
                                myItemsPage.requireLogin = true;
                                myItemsPage.setCategory(categoryObj);
                                myItemsPage.setItems(data);
                                Segue.loadPage(myItemsPage, '/pages/myitems/');
                            } else {
                                Segue.loadPage(createMessagePage('An error occurred. Please try again later.'), '/pages/myitems/');
                            }
                        });
                        
                    };

                    TSF.hasActiveUser(function (isSignedIn) {
                        if (isSignedIn) {
                            doLoadMyItems();
                        } else {
                            var loginPage = createLoginPage();
                            loginPage.next = function () {
                                doLoadMyItems();
                            };
                            Segue.loadPage(loginPage, '/pages/login/');
                            util.flashMessage('Sign in to view your shots.');
                        }
                    });
                },

                latestitemspage: function (pageData) {
                    TSF.getLatestItems(function (data) {
                        if (data && !data['error']) {
                            var categoryObj = {
                                id: 'latestitems',
                                name: 'Latest Shots'
                            };

                            var latestItemsPage = createCategoryPage(categoryObj.id);
                            latestItemsPage.setCategory(categoryObj);
                            latestItemsPage.setItems(data);
                            Segue.loadPage(latestItemsPage, '/pages/latesitems/');
                        } else {
                            Segue.loadPage(createMessagePage('An error occurred. Please try again later.'), '/pages/latesitems/');
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
                        util.alert('Ivalid page data. Please contact help desk.');
                    }
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

                loadHomePage: function () {
                    pageLoaders['homepage']();
                },

                loadLatestItemsPage: function () {
                    pageLoaders['latestitemspage']();
                },

                loadMyItemsPage: function () {
                    pageLoaders['myitemspage']();
                },

                loadCategoryPage: function (categoryInfo) {
                    pageLoaders['categorypage'](categoryInfo);
                },

                loadLogoutPage: function () {
                    pageLoaders['logoutpage']();
                },

                loadUploadPage: function () {
                    pageLoaders['uploadpage']();
                },

                loadViewItemPage: function (itemObj) {
                    pageLoaders['viewitempage']({}, itemObj);
                },

                loadEditItemPage: function (itemObj) {
                    pageLoaders['edititempage']({}, itemObj);
                },

                loadDeleteItemPage: function (itemObj) {
                    pageLoaders['deleteitempage']({}, itemObj);
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

        navBar.setActionFor('myshots', function () {
            PageFactory.loadMyItemsPage();
        });

        navBar.setActionFor('home', function () {
            PageFactory.loadHomePage();
        })

        // Setup footer
        var footer = new Footer();

        // Get Current user
        TSF.getSignedInUser(function (user) {
            if (user['name'] && user['picture']) {
                Segue.fireEvent('userevent');
            }
        });

        // Get landing page data
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
                //      to yield bandwith to other page data
                setTimeout(function () {
                    $.each(data, function (i, o) {
                        pageCover.addImage(o);
                    });
                }, 6000);
            }
        });

    });
})(window, document, jQuery);
