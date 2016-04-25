var _ = require('lodash');

/**
 * Created by noam
 */

module.exports.validate = function (compositionObject) {
    validateExplicitlyExportedPorts(compositionObject);
    validateVolumes(compositionObject);
};

function validateExplicitlyExportedPorts(compositionObject) {
    var portsDeclarations = declarationInComposition(compositionObject, 'ports');
    var compositionExportsAnyExplicitPorts = _.any(portsDeclarations, function (portDeclaration) {
        return portDeclaration.toString().includes(':');
    });
    if (compositionExportsAnyExplicitPorts) {
        throw new Error("Composition cannot explicitly export any ports");
    }
}

function validateVolumes(compositionObject) {
    var volumesDeclarations = declarationInComposition(compositionObject, 'volumes');
    var volumesFromDeclarations = declarationInComposition(compositionObject, 'volumes_from');
    if ((volumesDeclarations.length > 0) || volumesFromDeclarations.length > 0) {
        throw new Error("Composition cannot mount any volumes");
    }
}

function declarationInComposition(object, declaration) {
    if (_.has(object, declaration)) {
        return object[declaration];
    }
    return _.flatten(_.map(object, function (v) {
        return typeof v === "object" ? declarationInComposition(v, declaration) : [];
    }), true);
}