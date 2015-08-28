// Avoid `console` errors in browsers that lack a console.
(function() {
    var method;
    var noop = function () {};
    var methods = [
        'assert', 'clear', 'count', 'debug', 'dir', 'dirxml', 'error',
        'exception', 'group', 'groupCollapsed', 'groupEnd', 'info', 'log',
        'markTimeline', 'profile', 'profileEnd', 'table', 'time', 'timeEnd',
        'timeline', 'timelineEnd', 'timeStamp', 'trace', 'warn'
    ];
    var length = methods.length;
    var console = (window.console = window.console || {});

    while (length--) {
        method = methods[length];

        // Only stub undefined methods.
        if (!console[method]) {
            console[method] = noop;
        }
    }
}());

// Place any jQuery/helper plugins in here.

(function($) {
    var pluginName = 'photoupload';

    var defaults = {
        url: '/',
        type: 'POST',
        fieldName: 'image',
        maxFileSize: 0,
        acceptFiles: ['.jpg', '.jpeg', '.png', '.gif'],
        onInvalidFile: function(file){/*no-op*/},
        onUploadProgress: function(element, progress) {/*no-op*/}
    };

    var PhotoUpload = function (element, options) {
        this.element = $(element);
        this.settings = $.extend({}, defaults, options);

        this.init();

        return true;
    };

    var utils = {
        _onInvalidFile: function (file) {
            this.settings.onInvalidFile.call(this, file);
        },

        _onUploadProgress: function (element, progress) {
            this.settings.onUploadProgress.call(this, element, progress);
        },

        _processInputFileList: function (fileList, imagePlaceHolder) {
            var self = this;
            if (fileList && fileList[0]) {
                if (utils.isValidImageFile.call(self, fileList[0])) {
                    self.file = fileList[0];
                    utils.showImage.call(self, imagePlaceHolder, fileList[0]);
                } else {
                    utils._onInvalidFile.call(self, fileList[0]);
                }
            }
        },

        isValidImageFile: function (imageFile) {
            if (this.settings.maxFileSize != 0 && imageFile.size > this.settings.maxFileSize) {
                return false;
            }

            validExtensions = new RegExp(this.settings.acceptFiles.map(function (str) {
                return  ((str.match(/^\./)) ? '\\' : '\\.') + str + '$';
            }).join('|'), 'i');
            if (!imageFile.type.match(/^image\//) || !imageFile.name.match(validExtensions)) {
                return false;
            }

            return true;
        },

        showImage: function (imgElement, imageFile) {
            if (window.FileReader ) {
                var reader = new FileReader();
                reader.onload = function (event) {
                    imgElement.attr('src', event.target.result);
                };
                reader.readAsDataURL(imageFile);
            } 
        }
    };

    PhotoUpload.prototype.init = function () {
        var self = this;
        var container = self.element;
        var inputElem = $('<input type="file" accept="image/*" style="display: none">');
        var imageView = $('<img src="" style="max-width: 100%; max-height: 100%; position: relative; top: 50%">');


        container.css('text-align', 'center');

        imageView.css('-webkit-transform', 'translateY(-50%)');
        imageView.css('-moz-transform', 'translateY(-50%)');
        imageView.css('transform', 'translateY(-50%)');

        container.append(imageView, inputElem);
        self.inputField = inputElem;
        self.imageView = imageView;

        container.on('drop', function (event) {
            event.stopPropagation();
            event.preventDefault();

            utils._processInputFileList.call(self, event.originalEvent.dataTransfer.files, imageView);
        });

        container.on('click', function (event) {
            inputElem.trigger('click');
        });

        inputElem.click(function (event) {
            event.stopPropagation();
        });

        inputElem.on('change', function (event) {
            utils._processInputFileList.call(self, this.files, imageView);
        });
    };

    PhotoUpload.prototype.submit = function(title, category, description) {
        console.log("Submitting...");
        var self = this;

        if (!self.file) {
            console.log("No file selected");
            return;
        }

        var formData = new FormData();
        formData.append(self.settings.fieldName, self.file);
        formData.append('title', title);
        formData.append('category', category);
        formData.append('description', description);

        $.ajax({
            url: self.settings.url,
            type: self.settings.type,
            data: formData,
            cache: false,
            contentType: false,
            processData: false,
            xhr: function () {
                var xhrObj = $.ajaxSettings.xhr();
                if (xhrObj.upload) {
                    xhrObj.upload.addEventListener('progress', function (event) {
                        console.dir(event);
                        var percent = 0;
                        if (event.lengthComputable) {
                            var current = event.loaded || event.position;
                            var total = event.total || event.totalSize;
                            percent = Math.floor((current / total) * 100);
                        }
                        utils._onUploadProgress.call(self, self.element, percent);
                    }, false);
                }
                return xhrObj;
            },
            success: function (data, textStatus, jqXHR) {
                console.log('Upload success. ' + textStatus);
                console.dir(data);
            },
            error: function (jqXHR, textStatus, errorThrown) {
                console.dir(jqXHR);
                console.log('Upload Error: ' + textStatus + ' | ' + errorThrown);
            },
            complete: function (jqXHR, textStatus) {
                console.log('Upload complete. ' + textStatus);
            }
        });
    };

    $.fn.photoupload = function (options) {
        return this.each(function(index, obj){
            if (!$.data(this, pluginName)) {
                $.data(this, pluginName, new PhotoUpload(this, options));
            }
        });
    };

    // Disable Document drag & drop events to prevent opening/downloading the file on browser when we drop them
    $(document).on('dragenter dragover drop', function (event) {
        event.stopPropagation();
        event.preventDefault();
    });
}(jQuery));


/////////////////// Image Drop Plugin ///////////////////
(function ($) {
    var pluginName = 'imagedrop';

    var defaults = {
        maxFileSize: 0,
        acceptFiles: ['.jpg', '.jpeg', '.png', '.gif'],
        onChange: function (element, file) {/*no-op*/},
        onInvalidFile: function(element, file){/*no-op*/}
    };

    var utils = {
        _onChange: function (file) {
            this.settings.onChange.call(this, this.element, file);
        },

        _onInvalidFile: function (file) {
            this.settings.onInvalidFile.call(this, this.element, file);
        },

        _processInputFileList: function (fileList, imagePlaceHolder) {
            var self = this;
            if (fileList && fileList[0]) {
                utils._processInputFile.call(self, fileList[0], imagePlaceHolder);
            }
        },

        _processInputFile: function (aFile, imagePlaceHolder) {
            var self = this;
            if (utils.isValidImageFile.call(self, aFile)) {
                self.file = aFile;
                utils.showImage.call(self, imagePlaceHolder, aFile);
                utils._onChange.call(self, aFile);
            } else {
                utils._onInvalidFile.call(self, aFile);
            }
        },

        isValidImageFile: function (imageFile) {

            if (!imageFile) {
                return false;
            }

            if (this.settings.maxFileSize != 0 && imageFile.size > this.settings.maxFileSize) {
                return false;
            }

            validExtensions = new RegExp(this.settings.acceptFiles.map(function (str) {
                return  ((str.match(/^\./)) ? '\\' : '\\.') + str + '$';
            }).join('|'), 'i');
            if (!imageFile.type.match(/^image\//) || !imageFile.name.match(validExtensions)) {
                return false;
            }

            return true;
        },

        showImage: function (imgElement, imageFile) {
            if (window.FileReader ) {
                var reader = new FileReader();
                reader.onload = function (event) {
                    imgElement.attr('src', event.target.result);
                };
                reader.readAsDataURL(imageFile);
            } 
        }
    };

    var ImageDrop = function (element, options) {
        this.element = $(element);
        this.settings = $.extend({}, defaults, options);
        this.init();
        return true;
    };

    ImageDrop.prototype.init = function () {
        var self = this;
        var container = self.element;
        var inputElem = $('<input type="file" accept="image/*" style="display: none">');
        var imageView = $('<img src="" style="max-width: 100%; max-height: 100%; position: relative; top: 50%">');


        container.css('text-align', 'center');

        imageView.css('-webkit-transform', 'translateY(-50%)');
        imageView.css('-moz-transform', 'translateY(-50%)');
        imageView.css('transform', 'translateY(-50%)');

        container.append(imageView, inputElem);
        self.inputField = inputElem;
        self.imageView = imageView;

        container.on('drop', function (event) {
            event.stopPropagation();
            event.preventDefault();

            utils._processInputFileList.call(self, event.originalEvent.dataTransfer.files, imageView);
        });

        container.on('click', function (event) {
            inputElem.trigger('click');
        });

        inputElem.click(function (event) {
            event.stopPropagation();
        });

        inputElem.on('change', function (event) {
            utils._processInputFileList.call(self, this.files, imageView);
        });
    };

    ImageDrop.prototype.setFile = function (aFile) {
        utils._processInputFile.call(this, aFile, this.imageView);
    };

    ImageDrop.prototype.clearFile = function () {
        var self = this;
        if (self.file) {
            delete self.file;
            self.imageView.attr('src', '');
            utils._onChange.call(self);
        }
    };

    var _actions = {
        markUp: function (options) {
            return this.each(function(index, obj){
                if (!$.data(this, pluginName)) {
                    $.data(this, pluginName, new ImageDrop(this, options));
                }
            });
        },

        file: function(aFile) {
            if ('undefined' === typeof aFile) {
                var o = this.data(pluginName);
                return ( o ? o.file : undefined );
            } else {
                return this.each(function(index, obj){
                    var o = $.data(this, pluginName);
                    if (o) { o.setFile(aFile); }
                });
            }
        },

        clearFile: function() {
            return this.each(function(index, obj){
                var o = $.data(this, pluginName);
                if (o) { o.clearFile(); }
            });
        }
    };

    $.fn.imagedrop = function (action, options) {
        var args = arguments,
            act = 'markUp';

        if (arguments.length > 0 && 'string' === typeof arguments[0]) {
            act = arguments[0];
            args = Array.prototype.slice.call(arguments, 1);
        }

        return _actions[act].apply(this, args);
    };

    // Disable Document drag & drop events to prevent opening/downloading the file on browser when we drop them
    $(document).on('dragenter dragover drop', function (event) {
        event.stopPropagation();
        event.preventDefault();
    });
}(jQuery));
/////////////////// END: Image Drop Plugin ///////////////////

/////////////////// Ajax Upload Plugin ///////////////////
(function (w, $) {
    var className = 'AjaxUpload';

    var defaults = {
        url: '/',
        type: 'POST',
        cache: false,
        contentType: false,
        processData: false,
        headers: {},
        progress: function(xhrObj, percent) {/*no-op*/},
        success: function(data, textStatus, jqXHR) {/*no-op*/},
        error: function(jqXHR, textStatus, errorThrown) {/*no-op*/},
        complete: function(jqXHR, textStatus) {/*no-op*/}
    };

    var util = {
        fireEvent: function (key) {
            var self = this;
            var args = Array.prototype.slice.call(arguments, 1);

            self.settings[key].apply(self, args);
            $.each(self._listeners[key], function (index, obj) {
                obj.apply(self, args);
            });
        }
    };

    var AjaxUpload = function (options) {
        this.settings = $.extend({}, defaults, options);
        this._listeners = {
            'progress': [],
            'success': [],
            'error': [],
            'complete': []
        };
        return this;
    };

    AjaxUpload.prototype.options = function (options) {
        if ('undefined' !== options) {
            $.extend(this.settings, options);
        }
        return this.settings;
    };

    AjaxUpload.prototype.on = function (key, callback) {
        var self = this;
        if ('function' === typeof callback) {
            self._listeners[key].push(callback);
        }
        return self;
    };

    AjaxUpload.prototype.off = function (key, callbackRef) {
        var self = this;
        var index = self._listeners[key].indexOf(callbackRef);
        if (index > -1) {
            self._listeners[key].splice(index, 1);
        }
        return self;
    };

    AjaxUpload.prototype.abort = function () {
        var self = this;
        if (self.xhr) {
            xhr.abort();
        }
        return self;
    };

    AjaxUpload.prototype.submit = function (url, data) {
        var self = this;

        var u = ('string' === typeof url) ? url : self.settings.url;
        var d = ('object' === typeof url) ? url : data || {};

        var formData;
        if (!self.settings.contentType) {
            formData = new FormData();
            $.each(d, function (k ,o) {
                if ('object' === typeof o && o['file'] && o['filename']) {
                    formData.append(k, o['file'], o['filename']);
                } else {
                    formData.append(k, o);
                }
            });
        } else {
            formData = ('application/json' === self.settings.contentType) ?
                JSON.stringify(d) : d;
        }

        self.xhr = $.ajax({
            url: u,
            type: self.settings.type,
            data: formData,
            cache: self.settings.cache,
            headers: self.settings.headers,
            contentType: self.settings.contentType,
            processData: self.settings.processData,
            xhr: function () {
                var xhrObj = $.ajaxSettings.xhr();
                if (xhrObj.upload) {
                    xhrObj.upload.addEventListener('progress', function (event) {
                        var percent = 0;
                        if (event.lengthComputable) {
                            var current = event.loaded || event.position;
                            var total = event.total || event.totalSize;
                            percent = (current / total) * 100;
                        }
                        util.fireEvent.call(self, 'progress', xhrObj, percent);
                    }, false);
                }
                return xhrObj;
            },
            success: function (data, textStatus, jqXHR) {
                util.fireEvent.call(self, 'success', data, textStatus, jqXHR);
            },
            error: function (jqXHR, textStatus, errorThrown) {
                util.fireEvent.call(self, 'error', jqXHR, textStatus, errorThrown);
            },
            complete: function (jqXHR, textStatus) {
                util.fireEvent.call(self, 'complete', jqXHR, textStatus);
            }
        });

        return self;
    };

    w[className] = w[className] || AjaxUpload;

}(window, jQuery));
/////////////////// END: Ajax Upload Plugin ///////////////////

/////////////////// Slide Show Plugin ///////////////////
(function ($) {
    var pluginName = 'slideshow';

    var defaults = {
        duration: 7000
    };

    var util = {
        markUpImage: function (img) {
            var wrapped = img.addClass('slide-show-img').wrap('<div class="slide-show-img-wrap"></div>')
            return wrapped.parent();
        },

        showNext: function () {
            var self = this;
            if (0 === self.images.length) {
                self.currentIndex = -1;
                self.isPlaying = false;
                return;
            }

            if (self.currentIndex === -1) {
                self.currentIndex = 0;
                self.images[self.currentIndex].addClass('slide-show-img-show');
            }

            self.player = setTimeout(function () {
                var nextIndex = self.currentIndex + 1;
                nextIndex = (nextIndex >= self.images.length) ? 0 : nextIndex;
                self.images[self.currentIndex].removeClass('slide-show-img-show');
                self.images[nextIndex].addClass('slide-show-img-show');
                self.currentIndex = nextIndex;
                util.showNext.call(self);
            }, self.settings.duration);

            
            return self;
        }
    };

    var SlideShow = function (element, options) {
        var self = this;
        this.element = $(element);
        this.settings = $.extend({}, defaults, options);
        this.images = [];
        this.isPlaying = false;
        this.currentIndex = -1;

        this.init();

        return true;
    };

    SlideShow.prototype.init = function () {
        var self = this;
        self.element.addClass('slide-show-container');

        var images = self.element.find('img');
        $.each(images, function (i, o) {
            self.images.push(util.markUpImage.call(self, $(o)));
        });
    };

    SlideShow.prototype.start = function () {
        var self = this;
        if (!self.isPlaying) {
            self.isPlaying = true;
            util.showNext.call(self);
        }
        return self;
    };

    SlideShow.prototype.stop = function () {
        var self = this;
        clearTimeout(self.player);
        self.isPlaying = false;
        return self;
    };

    SlideShow.prototype.addImage = function (imgTag) {
        var self = this,
            newImg = util.markUpImage.call(self, imgTag);
        self.images.push(newImg);
        self.element.append(newImg);
        return self;
    };

    var _actions = {
        markUp: function (options) {
            return this.each(function(index, obj){
                if (!$.data(this, pluginName)) {
                    $.data(this, pluginName, new SlideShow(this, options));
                }
            });
        },

        start: function () {
            return this.each(function(index, obj){
                var o = $.data(this, pluginName);
                if (o) { o.start(); }
            });
        },

        stop: function () {
            return this.each(function(index, obj){
                var o = $.data(this, pluginName);
                if (o) { o.stop(); }
            });
        },

        addImage: function (imgTag) {
            return this.each(function(index, obj){
                var o = $.data(this, pluginName);
                if (o) { o.addImage(imgTag); }
            });
        }
    };

    $.fn.slideshow = function (action, options) {
        var args = arguments,
            act = 'markUp';

        if (arguments.length > 0 && 'string' === typeof arguments[0]) {
            act = arguments[0];
            args = Array.prototype.slice.call(arguments, 1);
        }

        return _actions[act].apply(this, args);
    };

}(jQuery));
/////////////////// END: Slide Show Plugin ///////////////////

/////////////////// Parallax Plugin ///////////////////
(function ($) {
    var pluginName = 'parallax';

    var defaults = {};

    var util = {
        parallaxScroll: function (viewPoint) {
            var h = this.parallaxView.height();
            if (viewPoint > h) {
                return;
            }

            var dh = this.parallaxLayer.height() - h,
                tp = (viewPoint/h) * dh;
            this.parallaxView.scrollTop(dh - tp);
        }
    };

    var Parallax = function (element, options) {
        var self = this;
        this.element = $(element);
        this.settings = $.extend({}, defaults, options);

        this.init();

        return true;
    };

    Parallax.prototype.init = function () {
        var self = this;
        self.parallaxView = $('<div class="parallax_view"></div>'),
        self.parallaxLayer = $('<div class="parallax_layer"></div>');

        self.parallaxLayer.append(self.element.contents());
        self.parallaxView.append(self.parallaxLayer);
        self.element.append(self.parallaxView);

        $(window).on('scroll', function (event) {
            util.parallaxScroll.call(self, $(window).scrollTop());
        });
        util.parallaxScroll.call(self, $(window).scrollTop());
    };

    var _actions = {
        markUp: function (options) {
            return this.each(function(index, obj){
                if (!$.data(this, pluginName)) {
                    $.data(this, pluginName, new Parallax(this, options));
                }
            });
        }
    };

    $.fn.parallax = function (action, options) {
        var args = arguments,
            act = 'markUp';

        if (arguments.length > 0 && 'string' === typeof arguments[0]) {
            act = arguments[0];
            args = Array.prototype.slice.call(arguments, 1);
        }

        return _actions[act].apply(this, args);
    };
}(jQuery));
/////////////////// END: Parallax Plugin ///////////////////
