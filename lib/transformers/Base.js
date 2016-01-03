var Q    = require('q');


var Base = function (model) {
    this.model = model;
};

Base.prototype.transform = function () { // jshint ignore:line
    return Q.reject(new Error("not implemented"));
};


module.exports = Base;
