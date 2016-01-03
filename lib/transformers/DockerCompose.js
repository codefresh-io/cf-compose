var util      = require('util');
var Q         = require('q');
var _         = require('lodash');
var Mustache  = require('mustache');
var YAML      = require('js-yaml');

var Base      = require('./Base');

var DockerComposeTransformer = function (model) {
    Base.call(this, model);
};

util.inherits(DockerComposeTransformer, Base);

DockerComposeTransformer.prototype.transformLinks = function () {
    var data = this.data;

    return Q.resolve()
        .then(function() {

            _.forIn(data, function(info) {
                _.forIn(info.result, function(service) {
                    var links = service.links;
                    if (links) {
                        var newLinks = [];

                        _.forEach(links, function(link) {

                            var linkData = link.split(":");

                            // TODO - support link template
                            //      ui:ui{{index}}

                            if (linkData.length === 2) {
                                return newLinks.push(link);
                            }
                            var refLink = linkData[0];
                            var refInfo = data[refLink];
                            if (!refInfo) {
                                throw new Error('Could not find link - ' + link);
                            }
                            _.forEach(_.keys(refInfo.result), function(name) {
                                newLinks.push(name);
                            })

                        });

                        service.links = newLinks;
                    }
                });
            });
        });
};

DockerComposeTransformer.prototype.transformEnvironment = function () {
    var data = this.data;

    _.forIn(data, function(info, name) {
        var orig = info.orig;
        if (!orig) {
            return;
        }

        var scale = orig.scale || 1;
        for (var pos=1; pos<=scale; pos++) {
            var itemName = name + (scale === 1 ? '' : pos);
            var item = info.result[itemName];
            var environment = item.environment;
            if (environment) {
                if (_.isArguments(environment)) {
                    var newEnvs = [];
                    _.forEach(environment, function(env) {
                        var newEnv = Mustache.render(env, {index:pos});
                        newEnvs.push(newEnv);
                    });
                    item.environment = newEnvs;
                } else {
                    _.forIn(environment, function(env, envName) {
                        if (_.isString(env)) {
                            var newEnv = Mustache.render(env, {index:pos});
                            environment[envName] = newEnv;
                        }
                    });
                }
            }
        }
    });

    return Q.resolve();
};

DockerComposeTransformer.prototype.transformRouting = function () {
    var data = this.data;

    var updateEnvironment = function(info, data) {
        var environment = info.environment || {};

        _.forIn(data, function(value, key) {
            if (_.isArray(environment)) {
                environment.push(key + "=" + value);
            } else {
                environment[key] = value;
            }
        });

        info.environment = environment;
    };

    _.forIn(data, function(info) {
        var orig = info.orig;
        if (!orig) {
            return;
        }

        var routing = orig.routing;
        if (!routing) {
            return;
        }

        _.forIn(info.result, function(service) {
            delete service.routing;
        });

        _.forIn(routing, function(table, portInfo) {
            var portList = portInfo.split("/");
            var port = portList[0];
            var mode = portList.length == 2 ? portList[1] : "http";

            if (mode === "tcp") {

                _.forEach(orig.links, function(link) {
                    var service = data[link];
                    _.forIn(service.result, function(info) {
                        updateEnvironment(info, {
                            TCP_PORTS: port
                        });
                    });
                });

            } else {

                _.forEach(table, function(row, index) {

                    var weight = table.length - index;
                    _.forIn(row, function(serviceName, route) {
                        var service = data[serviceName];
                        _.forIn(service.result, function(info) {
                            updateEnvironment(info, {
                                VIRTUAL_HOST: route,
                                VIRTUAL_HOST_WEIGHT: weight
                            });
                        });

                        weight--;
                    });
                });
            }
        });
    });

    return Q.resolve();
};

DockerComposeTransformer.prototype.transformScale = function () {
    var data = this.data;

    _.forIn(data, function(info, name) {

        var orig = info.orig;
        if (!orig) {
            return;
        }

        var scale = orig.scale || 1;
        for (var pos=1; pos<=scale; pos++) {
            var itemName = name + (scale === 1 ? '' : pos);
            var item = _.cloneDeep(orig);
            delete item.scale;
            info.result[itemName] = item;
        }
    });

    return Q.resolve();
};

DockerComposeTransformer.prototype.toOutput = function () {
    var data = this.data;

    var output = {}
    _.forIn(data, function(info) {
        _.forIn(info.result, function(service, name) {
            output[name] = service;
        });
    });

    return Q.resolve(YAML.safeDump(output));
    //return Q.resolve(output);
};

DockerComposeTransformer.prototype.transform = function () { // jshint ignore:line

    // first we just copy the data from model
    var data = {};
    this.data = data;

    _.forIn(this.model.data, function(service, name) {
        data[name] = {
            orig: service,
            result: {}
        }
    });

    return this.transformScale()
        .then(this.transformLinks.bind(this))
        .then(this.transformRouting.bind(this))
        .then(this.transformEnvironment.bind(this))
        .then(this.toOutput.bind(this));
};

module.exports = DockerComposeTransformer;
