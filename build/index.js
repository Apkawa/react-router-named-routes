(function (global, factory) {
    if (typeof define === "function" && define.amd) {
        define(['exports', 'react', 'react-router'], factory);
    } else if (typeof exports !== "undefined") {
        factory(exports, require('react'), require('react-router'));
    } else {
        var mod = {
            exports: {}
        };
        factory(mod.exports, global.react, global.reactRouter);
        global.index = mod.exports;
    }
})(this, function (exports, React, ReactRouter) {
    'use strict';

    Object.defineProperty(exports, "__esModule", {
        value: true
    });

    var _extends = Object.assign || function (target) {
        for (var i = 1; i < arguments.length; i++) {
            var source = arguments[i];

            for (var key in source) {
                if (Object.prototype.hasOwnProperty.call(source, key)) {
                    target[key] = source[key];
                }
            }
        }

        return target;
    };

    function _objectWithoutProperties(obj, keys) {
        var target = {};

        for (var i in obj) {
            if (keys.indexOf(i) >= 0) continue;
            if (!Object.prototype.hasOwnProperty.call(obj, i)) continue;
            target[i] = obj[i];
        }

        return target;
    }

    var OriginalLink = ReactRouter.Link;

    // Deliberately not using ES6 classes - babel spits out too much boilerplate
    //                                      and I don't want to add a dependency on babel
    //                                      runtime
    function NamedURLResolverClass() {
        this.routesMap = {};
    }

    function toArray(val) {
        return Object.prototype.toString.call(val) !== '[object Array]' ? [val] : val;
    }

    // Cached regexps:

    var reRepeatingSlashes = /\/+/g; // "/some//path"
    var reSplatParams = /\*{1,2}/g; // "/some/*/complex/**/path"
    var reResolvedOptionalParams = /\(([^:*?#]+?)\)/g; // "/path/with/(resolved/params)"
    var reUnresolvedOptionalParams = /\([^:?#]*:[^?#]*?\)/g; // "/path/with/(groups/containing/:unresolved/optional/:params)"
    var reTokens = /<(.*?)>/g;
    var reSlashTokens = /_!slash!_/g;

    NamedURLResolverClass.prototype.resolve = function (name, params) {
        if (name && name in this.routesMap) {
            var routePath = this.routesMap[name];

            if (params) {
                var tokens = {};

                for (var paramName in params) {
                    if (params.hasOwnProperty(paramName)) {
                        var paramValue = params[paramName];

                        if (paramName === "splat") {
                            // special param name in RR, used for "*" and "**" placeholders
                            paramValue = toArray(paramValue); // when there are multiple globs, RR defines "splat" param as array.
                            var i = 0;
                            routePath = routePath.replace(reSplatParams, function (match) {
                                var val = paramValue[i++];
                                if (val == null) {
                                    return "";
                                } else {
                                    var tokenName = 'splat' + i;
                                    tokens[tokenName] = match === "*" ? encodeURIComponent(val)
                                    // don't escape slashes for double star, as "**" considered greedy by RR spec
                                    : encodeURIComponent(val.toString().replace(/\//g, "_!slash!_")).replace(reSlashTokens, "/");
                                    return '<' + tokenName + '>';
                                }
                            });
                        } else {
                            // Rougly resolve all named placeholders.
                            // Cases:
                            // - "/path/:param"
                            // - "/path/(:param)"
                            // - "/path(/:param)"
                            // - "/path(/:param/):another_param"
                            // - "/path/:param(/:another_param)"
                            // - "/path(/:param/:another_param)"
                            var paramRegex = new RegExp('(\/|\\(|\\)|^):' + paramName + '(\/|\\)|\\(|$)');
                            routePath = routePath.replace(paramRegex, function (match, g1, g2) {
                                tokens[paramName] = encodeURIComponent(paramValue);
                                return g1 + '<' + paramName + '>' + g2;
                            });
                        }
                    }
                }
            }

            return routePath
            // Remove braces around resolved optional params (i.e. "/path/(value)")
            .replace(reResolvedOptionalParams, "$1")
            // Remove all sequences containing at least one unresolved optional param
            .replace(reUnresolvedOptionalParams, "")
            // After everything related to RR syntax is removed, insert actual values
            .replace(reTokens, function (match, token) {
                return tokens[token];
            })
            // Remove repeating slashes
            .replace(reRepeatingSlashes, "/")
            // If there was a single slash only, keep it
            .replace(/^$/, "/");
        }

        return name;
    };

    NamedURLResolverClass.prototype.mergeRouteTree = function (routes) {
        var _this = this;

        var prefix = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : "";

        routes = toArray(routes);

        routes.forEach(function (route) {
            if (!route) return;

            var newPrefix = "";
            if (route.props) {
                var routePath = route.props.path || "";
                var newPrefix = (routePath != null && routePath[0] === "/" ? routePath : [prefix, routePath].filter(function (x) {
                    return x;
                }).join("/")).replace(reRepeatingSlashes, "/");
                if (route.props.name) {
                    _this.routesMap[route.props.name] = newPrefix;
                }

                React.Children.forEach(route.props.children, function (child) {
                    _this.mergeRouteTree(child, newPrefix);
                });
            }
        });
    };

    NamedURLResolverClass.prototype.reset = function () {
        this.routesMap = {};
    };

    var NamedURLResolver = new NamedURLResolverClass();

    var Link = React.createClass({
        displayName: 'Link',
        render: function render() {
            var _props = this.props,
                to = _props.to,
                resolver = _props.resolver,
                params = _props.params,
                rest = _objectWithoutProperties(_props, ['to', 'resolver', 'params']);

            if (!resolver) resolver = NamedURLResolver;
            to = resolver.resolve(to, params);

            return React.createElement(OriginalLink, _extends({ to: to }, rest));
        }
    });

    function MonkeyPatchNamedRoutesSupport(routes) {
        var basename = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : "/";

        NamedURLResolver.mergeRouteTree(routes, basename);
        ReactRouter.Link = Link;
    };

    function setNamedURLResolver(resolver) {
        exports.NamedURLResolver = NamedURLResolver = resolver;
    };

    var resolve = NamedURLResolver.resolve.bind(NamedURLResolver);

    exports.Link = Link;
    exports.NamedLink = Link;
    exports.NamedURLResolver = NamedURLResolver;
    exports.NamedURLResolverClass = NamedURLResolverClass;
    exports.MonkeyPatchNamedRoutesSupport = MonkeyPatchNamedRoutesSupport;
    exports.FixNamedRoutesSupport = MonkeyPatchNamedRoutesSupport;
    exports.setNamedURLResolver = setNamedURLResolver;
    exports.resolve = resolve;
});
