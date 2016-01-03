var Q = require('Q');
var YAML = require('yamljs');

var Model = require('./model');
var DockerComposeTransformer = require('./transformers/DockerCompose');

var Transformer = function(opts) {
    if (!(this instanceof Transformer)) return new Transformer(opts);
    this.opts = opts;
};

Transformer.prototype.load = function() {
    var file = this.opts.file;
    return Q.resolve()
        .then(function() {
            var deferred = Q.defer();
            YAML.load(file, function(result) {

                deferred.resolve(new Model(result));
            });
            return deferred.promise;
        });
};

Transformer.prototype.transfer = function() {
    var deferred = Q.defer();
    YAML.load(this.opts.file, function(result) {
        deferred.resolve(result);
    });
    return deferred.promise;
};

Transformer.prototype.toDockerCompose = function() {
    return this.load()
        .then(function(model) {
            var transformer = new DockerComposeTransformer(model);
            return transformer.transform();
        });
};

module.exports = Transformer;