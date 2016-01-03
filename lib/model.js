
var Model = function(data) {
    if (!(this instanceof Model)) return new Model(data);
    this.data = data;
};


module.exports = Model;