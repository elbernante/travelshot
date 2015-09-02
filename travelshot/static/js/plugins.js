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

    ImageDrop.prototype.displayImageUrl = function (url) {
        var self = this;
        if (url) {
            self.imageView.attr('src', url);
            return self;
        } else {
            return self.imageView.attr('src');
        }
    };

    var _actions = {
        markUp: function (options) {
            return this.each(function (index, obj) {
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
                return this.each(function (index, obj) {
                    var o = $.data(this, pluginName);
                    if (o) { o.setFile(aFile); }
                });
            }
        },

        clearFile: function() {
            return this.each(function (index, obj) {
                var o = $.data(this, pluginName);
                if (o) { o.clearFile(); }
            });
        },

        displayImageUrl: function (url) {
            if (url) {
                return this.each(function (index, obj) {
                    var o = $.data(this, pluginName);
                    if (o) { o.displayImageUrl(url); }
                });
            } else {
                var o = this.data(pluginName);
                return ( o ? o.displayImageUrl() : undefined );
            }
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

/////////////////// Image Resizer ///////////////////
(function ($) {
    var className = 'ImageResizer';
    
    var defaults = {
        maxWidth: 800,
        quality: 0.9
    };

    var ImageResizer = function (options) {
        this.settings = $.extend({}, defaults, options);
        return this;
    };

    ImageResizer.prototype.scaleImage = function(imgElement) {
        var canvas = document.createElement('canvas');
        canvas.width = imgElement.width;
        canvas.height = imgElement.height;
        canvas.getContext('2d').drawImage(imgElement, 0, 0, canvas.width, canvas.height);

        while (canvas.width >= (2 * this.settings.maxWidth)) {
            canvas = this.getHalfScaleCanvas(canvas);
        }

        if (canvas.width > this.settings.maxWidth) {
            canvas = this.scaleCanvasWithAlgorithm(canvas);
        }

        var imageData = canvas.toDataURL('image/jpeg', this.settings.quality);
        return this.dataURLToBlob(imageData);
    };

    ImageResizer.prototype.dataURLToBlob = function(dataURL) {
        var BASE64_MARKER = ';base64,';
        if (dataURL.indexOf(BASE64_MARKER) == -1) {
            var parts = dataURL.split(',');
            var contentType = parts[0].split(':')[1];
            var raw = parts[1];

            return new Blob([raw], {type: contentType});
        }

        var parts = dataURL.split(BASE64_MARKER);
        var contentType = parts[0].split(':')[1];
        var raw = window.atob(parts[1]);
        var rawLength = raw.length;

        var uInt8Array = new Uint8Array(rawLength);

        for (var i = 0; i < rawLength; ++i) {
            uInt8Array[i] = raw.charCodeAt(i);
        }

        return new Blob([uInt8Array], {type: contentType});
    };

    ImageResizer.prototype.scaleCanvasWithAlgorithm = function(canvas) {
        var scaledCanvas = document.createElement('canvas');

        var scale = this.settings.maxWidth / canvas.width;

        scaledCanvas.width = canvas.width * scale;
        scaledCanvas.height = canvas.height * scale;

        var srcImgData = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
        var destImgData = scaledCanvas.getContext('2d').createImageData(scaledCanvas.width, scaledCanvas.height);

        this.applyBilinearInterpolation(srcImgData, destImgData, scale);

        scaledCanvas.getContext('2d').putImageData(destImgData, 0, 0);

        return scaledCanvas;
    };

    ImageResizer.prototype.getHalfScaleCanvas = function(canvas) {
        var halfCanvas = document.createElement('canvas');
        halfCanvas.width = canvas.width / 2;
        halfCanvas.height = canvas.height / 2;

        halfCanvas.getContext('2d').drawImage(canvas, 0, 0, halfCanvas.width, halfCanvas.height);

        return halfCanvas;
    };

    ImageResizer.prototype.applyBilinearInterpolation = function(srcCanvasData, destCanvasData, scale) {
        function inner(f00, f10, f01, f11, x, y) {
            var un_x = 1.0 - x;
            var un_y = 1.0 - y;
            return (f00 * un_x * un_y + f10 * x * un_y + f01 * un_x * y + f11 * x * y);
        }
        var i, j;
        var iyv, iy0, iy1, ixv, ix0, ix1;
        var idxD, idxS00, idxS10, idxS01, idxS11;
        var dx, dy;
        var r, g, b, a;
        for (i = 0; i < destCanvasData.height; ++i) {
            iyv = i / scale;
            iy0 = Math.floor(iyv);
            // Math.ceil can go over bounds
            iy1 = (Math.ceil(iyv) > (srcCanvasData.height - 1) ? (srcCanvasData.height - 1) : Math.ceil(iyv));
            for (j = 0; j < destCanvasData.width; ++j) {
                ixv = j / scale;
                ix0 = Math.floor(ixv);
                // Math.ceil can go over bounds
                ix1 = (Math.ceil(ixv) > (srcCanvasData.width - 1) ? (srcCanvasData.width - 1) : Math.ceil(ixv));
                idxD = (j + destCanvasData.width * i) * 4;
                // matrix to vector indices
                idxS00 = (ix0 + srcCanvasData.width * iy0) * 4;
                idxS10 = (ix1 + srcCanvasData.width * iy0) * 4;
                idxS01 = (ix0 + srcCanvasData.width * iy1) * 4;
                idxS11 = (ix1 + srcCanvasData.width * iy1) * 4;
                // overall coordinates to unit square
                dx = ixv - ix0;
                dy = iyv - iy0;
                // I let the r, g, b, a on purpose for debugging
                r = inner(srcCanvasData.data[idxS00], srcCanvasData.data[idxS10], srcCanvasData.data[idxS01], srcCanvasData.data[idxS11], dx, dy);
                destCanvasData.data[idxD] = r;

                g = inner(srcCanvasData.data[idxS00 + 1], srcCanvasData.data[idxS10 + 1], srcCanvasData.data[idxS01 + 1], srcCanvasData.data[idxS11 + 1], dx, dy);
                destCanvasData.data[idxD + 1] = g;

                b = inner(srcCanvasData.data[idxS00 + 2], srcCanvasData.data[idxS10 + 2], srcCanvasData.data[idxS01 + 2], srcCanvasData.data[idxS11 + 2], dx, dy);
                destCanvasData.data[idxD + 2] = b;

                a = inner(srcCanvasData.data[idxS00 + 3], srcCanvasData.data[idxS10 + 3], srcCanvasData.data[idxS01 + 3], srcCanvasData.data[idxS11 + 3], dx, dy);
                destCanvasData.data[idxD + 3] = a;
            }
        }
    };

    window[className] = window[className] || ImageResizer;
}(jQuery));
/////////////////// END: Image Resizer ///////////////////

/////////////////// Ajax Upload Plugin ///////////////////
(function (w, $) {
    var className = 'AjaxUpload';

    var defaults = {
        url: '/',
        resizeImageOnSize: 0,
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

        // Resize image files if needed
        self._sanitzeData(d, function (sanitized) {
            self._doSubmit(u, sanitized);
        });

        return self;
    },

    AjaxUpload.prototype._sanitzeData = function (data, callback) {
        var self = this;

        var dataLength = Object.getOwnPropertyNames(data).length,
            sanitizedData = {},
            isImageFile = function (fileObj) {
                return fileObj.type.match(/^image\//, 'i');
            },
            needsResize = function (fileObj) {
                return (self.settings.resizeImageOnSize !== 0 
                        && fileObj.size > self.settings.resizeImageOnSize) ?
                            true : false;
            },
            didSanitize = function () {
                if (Object.getOwnPropertyNames(sanitizedData).length === dataLength) {
                    callback.call(self, sanitizedData);
                }
            };

        $.each(data, function (k, o) {
            if (o instanceof File && isImageFile(o) && needsResize(o)) {
                var reader = new FileReader(),
                    imgElement = $(new Image());

                reader.onload = function (event) {
                    imgElement.attr('src', event.target.result);
                    var resized = new ImageResizer().scaleImage(imgElement.get(0));
                    sanitizedData[k] = {
                        file: resized,
                        filename: 'img.jpeg'
                    };
                    didSanitize();
                };
                reader.readAsDataURL(o);
            } else {
                sanitizedData[k] = o;
                didSanitize();
            }
        });
    },

    AjaxUpload.prototype._doSubmit = function (url, data) {
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
