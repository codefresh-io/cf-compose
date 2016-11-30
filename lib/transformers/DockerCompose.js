var util      = require('util');
var Q         = require('q');
var _         = require('lodash');
var Mustache  = require('mustache');
var YAML      = require('js-yaml');

var Base      = require('./Base');
var IntrusiveFeaturesValidator = require('./IntrusiveFeaturesValidator');

var DockerComposeTransformer = function (opts, model) {
    Base.call(this, opts, model);
    this.version2Composition = (this.model.data.version === '2');
    if (this.opts.compositionVars){
        this.opts.compositionVars.forEach(function(composeVar){
            composeVar.key = '$' + composeVar.key;
        });
    }
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
                            });

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
                    _.forEach(environment, function(env) { // jshint ignore:line
                        var newEnv = Mustache.render(env, {index:pos});
                        newEnvs.push(newEnv);
                    }); // jshint ignore:line
                    item.environment = newEnvs;
                } else {
                    _.forIn(environment, function(env, envName) { // jshint ignore:line
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
            var mode = portList.length === 2 ? portList[1] : "http";

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

var injectVarsToObject = function(object, vars) {

    function iterate(object) {
        for (var property in object) {
            if (object.hasOwnProperty(property)) {
                if (typeof object[property] === "object")
                    iterate(object[property]);
                else {
                    var field = object[property];
                    var replaceWiths = _.filter(vars, function(v){ // jshint ignore:line
                        if (typeof field === 'string' || field instanceof String){
                            return field.includes(v.key);
                        }
                        else {
                            return false;
                        }
                    });
                    replaceWiths.forEach(function(replaceWith){ // jshint ignore:line
                        object[property] = object[property].replace(replaceWith.key, replaceWith.value);
                    });
                }
            }
        }
    }

    iterate(object);
    return Q.resolve();

};

DockerComposeTransformer.prototype.toOutput = function () {
    var data = this.data;

    var services = {};
    _.forIn(data, function(info) {
        _.forIn(info.result, function(service, name) {
            services[name] = service;
        });
    });

    var output = {};
    if (this.version2Composition) {
        output.version = '2';
        output.services = services;
        if (this.model.data.networks) {
            injectVarsToObject(this.model.data.networks, this.opts.compositionVars);
            output.networks = this.model.data.networks;
        }
        if (this.model.data.volumes) {
            injectVarsToObject(this.model.data.volumes, this.opts.compositionVars);
            output.volumes = this.model.data.volumes;
        }
    } else {
        output = services;
    }

    var yamlString = YAML.safeDump(output);
    return Q.resolve(yamlString);
};

DockerComposeTransformer.prototype.transformHandlers = function() {
    var self = this;

    var handlers = this.opts.handlers;
    if (!handlers) {
        return Q.resolve();
    }

    var promises = [];
    var data = this.data;

    _.forIn(handlers, function(handler, name) {

        _.forIn(data, function(info) {
            var orig = info.orig;
            if (orig[name]) {
                promises.push(handler.call(self, info));
            }
        });

    });

    return Q.all(promises);
};


DockerComposeTransformer.prototype.injectCompositionVars = function() {
    return injectVarsToObject(this.data, this.opts.compositionVars);
};

DockerComposeTransformer.prototype.validateIntrusiveFeatures = function(yamlString) {
    if (!this.opts.validateIntrusiveFeatures) {
        return Q.resolve(yamlString);
    }

    try {
        var compositionObject = YAML.safeLoad(yamlString);

        // remove all services that were marked by the engine explicitly to not be validated
        if (_.get(compositionObject, 'version', '') === 2) {
            compositionObject.services = _.filter(compositionObject.services, function(service) {
                return !service.dontValidateIntrusiveFeatures;
            });
        } else {
            compositionObject = _.filter(compositionObject, function(service) {
                return !service.dontValidateIntrusiveFeatures;
            });
        }

        IntrusiveFeaturesValidator.validate(compositionObject);

        // remove all occurencees of dontValidateIntrusiveFeatures field on services
        compositionObject = YAML.safeLoad(yamlString);
        var compositionServices;
        if (_.get(compositionObject, 'version', '') === 2) {
            compositionServices = compositionObject.services;
        } else {
            compositionServices = compositionObject;
        }
        _.forEach(compositionServices, function(service) {
            delete service.dontValidateIntrusiveFeatures;
        });
        yamlString = YAML.dump(compositionObject);

    } catch (e) {
        return Q.reject(e);
    }

    return Q.resolve(yamlString);
};

DockerComposeTransformer.prototype.transform = function () {

    // first we just copy the data from model
    var data = {};
    this.data = data;

    var services;
    if (this.version2Composition) {
        services = this.model.data.services;
    } else {
        services = this.model.data;
    }
    _.forIn(services, function(service, name) {
        data[name] = {
            orig: service,
            result: {}
        };
    });

    return this.transformScale()
        .then(this.transformLinks.bind(this))
        .then(this.transformRouting.bind(this))
        .then(this.transformEnvironment.bind(this))
        .then(this.injectCompositionVars.bind(this))
        .then(this.transformHandlers.bind(this))
        .then(this.toOutput.bind(this))
        .then(this.validateIntrusiveFeatures.bind(this));
};

module.exports = DockerComposeTransformer;