var Q = require('q');
var YAML = require('yamljs');

var Model = require('./model');
var DockerComposeTransformer = require('./transformers/DockerCompose');
var IntrusiveFeaturesValidator = require('./transformers/IntrusiveFeaturesValidator');

var Transformer = function (opts) {
    if (!(this instanceof Transformer)) return new Transformer(opts);
    this.opts = opts;
};

function loadYaml(content) {
    return Q.resolve(new Model(YAML.parse(content)));
}

function loadJson(content) {
    return Q.resolve(new Model(JSON.parse(content)));
}

function loadFromFile(file) {
    return Q.resolve()
        .then(function () {
            var deferred = Q.defer();
            YAML.load(file, function (result) {
                deferred.resolve(new Model(result));
            });
            return deferred.promise;
        });
}

Transformer.prototype.transfer = function () {
    var deferred = Q.defer();
    YAML.load(this.opts.file, function (result) {
        deferred.resolve(result);
    });
    return deferred.promise;
};

Transformer.prototype.yamlToCompose = function (yaml) {
    var loadPromise = loadYaml(yaml);
    return toDockerCompose(loadPromise, this.opts);
};

Transformer.prototype.jsonToCompose = function (json) {
    var loadPromise = loadJson(json);
    return toDockerCompose(loadPromise, this.opts);
};

Transformer.prototype.fileToCompose = function () {
    var loadPromise = loadFromFile(this.opts.file);
    return toDockerCompose(loadPromise, this.opts);
};

Transformer.prototype.objectToCompose = function (object) {
    return toDockerCompose(Q.resolve(new Model(object)), this.opts);
};

Transformer.prototype.intrusiveFeaturesValidator = IntrusiveFeaturesValidator;

function toDockerCompose(loadPromise, opts) {
    return loadPromise
        .then(function (model) {
            var transformer = new DockerComposeTransformer(opts, model);
            return transformer.transform();
        });
}

module.exports = Transformer;