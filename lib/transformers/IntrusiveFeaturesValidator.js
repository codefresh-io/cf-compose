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
    var localFilesystemVolumes = _.any(volumesDeclarations, function (volumeDeclaration) {

        var sourceVolume;
        if (!volumeDeclaration.includes(':')) {
            return false;
        }

        var externalVolumeElements = volumeDeclaration.split(':');
        sourceVolume  = externalVolumeElements[0];

        return sourceVolume.includes('.') || sourceVolume.includes('/') || sourceVolume.includes('~');
    });
    if (localFilesystemVolumes) {
        throw new Error("Composition cannot mount volumes from the local filesystem");
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