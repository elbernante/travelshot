// {
//     tsPage: {
//         showbanner: true,
//         elements: [

//         ]
//     }
// }


// {

//     elements:[]
// }

/*
Finding the object where a property is defined

The following function iterates over the property chain of an object obj. It returns the first object that has an own property with the key propKey, or null if there is no such object:
function getDefiningObject(obj, propKey) {
    obj = Object(obj); // make sure it’s an object
    while (obj && !{}.hasOwnProperty.call(obj, propKey)) {
        obj = Object.getPrototypeOf(obj);
        // obj is null if we have reached the end
    }
    return obj;
}


Copying an Object
To create an identical copy of an object, you need to get two things right:
The copy must have the same prototype (see Layer 2: The Prototype Relationship Between Objects) as the original.
The copy must have the same properties, with the same attributes as the original.
The following function performs such a copy:
function copyObject(orig) {
    // 1. copy has same prototype as orig
    var copy = Object.create(Object.getPrototypeOf(orig));

    // 2. copy has all of orig’s properties
    copyOwnPropertiesFrom(copy, orig);

    return copy;
}
The properties are copied from orig to copy via this function:
function copyOwnPropertiesFrom(target, source) {
    Object.getOwnPropertyNames(source)  // (1)
    .forEach(function(propKey) {  // (2)
        var desc = Object.getOwnPropertyDescriptor(source, propKey); // (3)
        Object.defineProperty(target, propKey, desc);  // (4)
    });
    return target;
};

*/




(function (w, d) {

    var classPool = {};
    var storybook = {};

    var segue = classPool;
        segue['storybook'] = storybook;

    var nextSequence = function () {
        var seed = 0;
        return function () {
            return ++seed;
        }
    }();


    var Class = function (name, options) {
        // Check if class already exists.
        if (classPool[name]) {
            throw 'Class name "' + name + '" already exists.';
        }

        // Set class constructor
        if (options && options['init']) {
            classPool[name] = options['init'];
        }

        // Create a default constructor if none was supplied.
        classPool[name] = classPool[name] || function init () {
            return this;
        };

        // Set super class if there is any
        if (options && options['base']) {
            var baseClass = options['base'];
            if ('string' === typeof baseClass) {
                if (!classPool[baseClass]) {
                    throw 'Class "' + baseClass + '" does not exists.';
                }
                baseClass = classPool[baseClass];
            }
            classPool[name].prototype = new baseClass();
            classPool[name].prototype['base'] = baseClass;
        }

        // Set prototype methods
        if (options) {
            for (var p in options) {
                if ('init' !== p && 'base' !== p) {
                    classPool[name].prototype[p] = options[p];
                }
            }
        }

        classPool[name].prototype.className = name;
        return  classPool[name];
    };
    classPool['Class'] = Class;

    var createFromObject = function (obj) {
        if (!obj['className'] || !classPool[obj['className']]) {
            throw "No matching class found for the object.";
        }

        var newObj = new classPool[obj['className']];

        // Copy properties
        var props = Object.getOwnPropertyNames(obj);
        for (var i = 0, l = props.length; i < l; i++) {
            if ('className' !== props[i] && 'elements' !== props[i]) {
                var desc = Object.getOwnPropertyDescriptor(obj, props[i]);
                Object.defineProperty(newObj, props[i], desc);
            }
        }
        
        // Create child elements
        newObj['elements'] = [];
        if (obj['elements']) {
            for (var i = 0, l = obj['elements'].length; i < l; i++) {
                newObj['elements'].push(createFromObject(obj['elements'][i]));
            }
        }

        return newObj;
    };
    classPool['createFromObject'] = createFromObject;


    var loadPage = function (pageObj, url, title) {
        // save current page to history
        if (!storybook['initialPage']) {
            storybook['initialPage'] = pageObj;
            storybook['initialPageUrl'] = url;
        } else {
            var storyId = nextSequence();
            storybook[storyId] = pageObj;
            w.history.pushState({storyId: storyId}, title || 'No Title', url);
        }

        if (storybook['currentPage']) {
            storybook['currentPage'].dismiss();
        }

        storybook['currentPage'] = pageObj;
        pageObj.load();
        return pageObj;
    };
    classPool['loadPage'] = loadPage;


    //listen to window onpopstate
    w.onpopstate = function(event) {
        var pageObj;

        if (event.state && event.state['storyId']) {
            pageObj = storybook[event.state['storyId']];
        } else {
            pageObj = storybook['initialPage'];
        }

        if (pageObj) {
            if (storybook['currentPage']) {
                if (storybook['currentPage'] === pageObj) {
                    return;
                }
                storybook['currentPage'].dismiss();
            }
            storybook['currentPage'] = pageObj;
            pageObj.load();
        } else {
            w.history.replaceState({}, 'Landing Page', storybook['initialPageUrl'] || '/');
        }
    };

    var util = function () {
        var regExEscaper = /[.*+?^=!:${}()|\[\]\/\\]/g,
            regExEscape = function (str) { return str.replace(regExEscaper, '\\$&'); },
            toRegEx = function (str, flag) { return new RegExp(regExEscape(str), flag); };

        var varTag = ['{$', '$}'],
            binderPlaceHolder = new RegExp(regExEscape(varTag[0]) + '.*?' + regExEscape(varTag[1]) , 'g');

        return {
            toRegEx: toRegEx,

            replaceAll: function (string, find, replace) {
                return string.replace(toRegEx(find, 'g'), replace);
            },

            getPlaceHolders: function (str) {
                return str.match(binderPlaceHolder);
            },

            wrapWithPlaceHolders: function (str) {
                return varTag[0] + str + varTag[1];
            },

            resolveProp: function (prop, model) {
                // strip off place holder token
                var strippedProp = prop.replace(/[{}$\s]/g, ''),
                    propChain = strippedProp.split('.'),
                    ref = model;

                for (var i = 0, l = propChain.length; i < l; i++) {
                    var p = propChain[i];
                    if ('' === p) {
                        throw 'No property name specified.';
                    }
                    ref = ref[p];
                }
                    
                return ref;
            },

            extend: function () {
                var target = arguments[0];

                if (2 > arguments.length) {
                    return target;
                }
                
                for (var i = 1, l = arguments.length; i < l; i++) {
                    var src =  arguments[i];
                    for (var p in src) {
                        target[p] = src[p];
                    }
                }

                return target;
            },

            makeSubscribable: function (target) {
                target['subscribers'] = [];
                util.extend(target, subscribable);
                return target;
            },

            isSubscribable: function (target) {
                for (var p in subscribable) {
                    if (!target[p]) {
                        return false;
                    }
                }
                return true;
            }
        };
    }();

    var subscribable = function () {
        return {
            subscribe: function (sbscrbr) {
                this['subscribers'].push(sbscrbr);
            },

            notifiySubcribers: function () {
                for (var i = 0, l = this['subscribers'].length; i < l; i++) {
                    this['subscribers'][i]();
                }
            }
        }
    }();

    var bindable = function(initialValue) {
        var bindover = function () {
            if (0 < arguments.length) {
                var oldValue = bindover['currentValue'];
                bindover['currentValue'] = arguments[0];
                bindover['notifiySubcribers']();
                return this;
            } else {
                return bindover['currentValue'];
            }
        };

        bindover['currentValue'] = initialValue;
        util.makeSubscribable(bindover);

        return bindover;
    };
    classPool['bindable'] = bindable;

    var computed = function (evaluatorFunc, target) {
        var tr = target || this;
        
        var handler = function () {
            return handler['currentValue'];
        };

        handler['currentValue'] = evaluatorFunc.call(tr);
        util.makeSubscribable(handler);

        handler['reevaluator'] = function () {
            handler['currentValue'] = evaluatorFunc.apply(tr);
            handler['notifiySubcribers']();
        };

        /*
         * Makes the current subcribable  subcribe to a target subscribable.
         * (i.e. current subscribable is dependent to the target subcribable)
         */
        handler['subscribeTo'] = function (targetSubcribables) {
            for (var i = 0, l = arguments.length; i < l; i++) {
                if (!util.isSubscribable(arguments[i])) {
                    throw 'Subscribing to unscribable target.';
                }
                arguments[i]['subscribe'](handler['reevaluator']);
            }
            return handler;
        };

        return handler;
    };
    classPool['computed'] = computed;

    // Text Node and Element Attribute binder
    var bindTextNodeOrAttr = function (placeHolders, textNodeOrAttr, model) {

        var valueAcccessor = (textNodeOrAttr['nodeType'] && textNodeOrAttr['nodeType'] === Node.TEXT_NODE) ?
                                    'nodeValue' : 'value'
        var uniquePlaceHolders = {};
        var observables = {};
        var updatedValue = textNodeOrAttr[valueAcccessor];

        var valueUpdater = function () {
            var resolvedValue = updatedValue;
            for (var p in observables) {
                resolvedValue = util.replaceAll(resolvedValue, p, observables[p]());
            }
            textNodeOrAttr[valueAcccessor] = resolvedValue;
        };

        for (var i = 0, l = placeHolders.length; i < l; i++) {
            // resolve variable
            // if variable is subscribable, then subscribe
            // if function, then evaluate and then assign
            // if litetral, then assign
            if (!uniquePlaceHolders[placeHolders[i]]) {
                var resolvedProp = util.resolveProp(placeHolders[i], model);
                uniquePlaceHolders[placeHolders[i]] = resolvedProp;
                if (util.isSubscribable(resolvedProp)) {
                    observables[placeHolders[i]] = resolvedProp;
                    resolvedProp.subscribe(valueUpdater);
                } else if ('function' === typeof resolvedProp) {
                    updatedValue = util.replaceAll(updatedValue, placeHolders[i], resolvedProp());
                } else {
                    updatedValue = util.replaceAll(updatedValue, placeHolders[i], resolvedProp);
                }
            }
        }

        valueUpdater();
    };

    var segueBinders = function () {
        var binders = {
        };

        return {
            binders: binders,
            registerBinderForKey: function (attrBinder, options) {
                // TODO: check options if it has all mandatory function
                //      e.g. process, etc
                //  throw error if at least one is missing
                binders[attrBinder] = options;
            }
        };
    }();


    segueBinders.registerBinderForKey('data-sg-attr-bind', function () {
        var processor = function (attr, elementNode, model) {
            var attrArr = attr['value'].replace(/[\s]/g , '').split(';');
            
            for (var i = 0, l = attrArr.length; i < l; i++) {
                if ('' !== attrArr[i]) {
                    var t_attr =  attrArr[i].split(':'),
                        n_att = d.createAttribute(t_attr[0]);

                    n_att.value = util.wrapWithPlaceHolders(t_attr[1]);
                    bindTextNodeOrAttr([n_att.value], n_att, model);
                    elementNode.setAttributeNode(n_att);
                }
            }
        };

        return {
            process: processor
        }
    }());


    var processAttrsOfNode = function (elementNode, model) {
        var attributes = elementNode.attributes;
        if (!attributes) { return; };

        for (var i = 0, l = attributes.length; i < l; i++) {
            var currentAttribute = attributes.item(i),
                sgBinder = segueBinders['binders'][currentAttribute.name];
            if (sgBinder) {
                sgBinder['process'](currentAttribute, elementNode, model);
            } else {
                var placeHolders = util.getPlaceHolders(currentAttribute.value);
                if (placeHolders) {
                    bindTextNodeOrAttr(placeHolders, currentAttribute, model);
                }
            }  
        }
    };

    var traveseNodes = function (nodes, model) {
        for (var i = 0, l = nodes.length; i < l; i++) {
            var currentNode = nodes[i];
            processAttrsOfNode(currentNode, model);

            // If text node, process for placeholders
            if (currentNode.nodeType === Node.TEXT_NODE) {
                var placeHolders = util.getPlaceHolders(currentNode.nodeValue);
                if (placeHolders) {
                    bindTextNodeOrAttr(placeHolders, currentNode, model);
                }
            }

            // Process child nodes
            traveseNodes(currentNode.childNodes, model);
        }
    };

    var applyBindings = function (rootNode,  model) {
        if (rootNode.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
            traveseNodes(rootNode.childNodes, model);
        } else {
            traveseNodes([rootNode], model);
        }
    };
    classPool['applyBindings'] = applyBindings;


    // Class definitions

    var Element = Class('Element', {
        init: function () {
            this.elements = [];
            return this;
        },

        hasElements: function () {
            return this.elements.length > 0;
        },

        toPlainObject: function () {
            var obj = {};
            for (var p in this) {
                if ('elements' !== p && Object.hasOwnProperty.call(this, p)) {
                    obj[p] = this[p];
                }
            }
            obj['className'] = this['className'];

            obj['elements'] = [];
            for (var i = 0, l = this.elements.length; i < l; i++) {
                obj['elements'].push(this.elements[i].toPlainObject());
            }
            return obj;
        }
    });

    var Banner = Class('Banner', {
        base: Element,
        init: function () {
            return this;
        }
    });

    var Page = Class('Page', {

        base: Element,

        init: function (title) {
            this.base.apply(this, arguments);
            this.showbanner = false;
            this.title = title;
            return this;
        },

        dismiss: function () {
            console.log('dismmising page: ' + this.title);
        },

        load: function () {
            console.log('loading page: ' + this.title);
        }
    });

    w['Segue'] = segue;

}(window, document));