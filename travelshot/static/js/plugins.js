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

(function($){
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
})(jQuery);