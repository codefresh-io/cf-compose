var Q = require('q');
var YAML = require('yamljs');

var Model = require('./model');
var DockerComposeTransformer = require('./transformers/DockerCompose');

var Transformer = function(opts) {
    if (!(this instanceof Transformer)) return new Transformer(opts);
    this.opts = opts;
};

Transformer.prototype.load = function(json) {
    if (json) {
        return Q.resolve(new Model(JSON.parse(json)));
    }

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

Transformer.prototype.toDockerCompose = function(json) {
    var opts = this.opts;
    return this.load(json)
        .then(function(model) {
            var transformer = new DockerComposeTransformer(opts, model);
            return transformer.transform();
        });
};

module.exports = Transformer;
