var _ = require('lodash');

/**
 * Created by noam
 */

module.exports.validate = function (compositionObject) {
    validateExplicitlyExportedPorts(compositionObject);
    validateVolumes(compositionObject);
};

function validateExplicitlyExportedPorts(compositionObject) {
    var collectedDeclarations = [];
    declarationInComposition(collectedDeclarations, compositionObject, 'ports');
    collectedDeclarations = _.flatten(collectedDeclarations, true);
    var compositionExportsAnyExplicitPorts = _.some(collectedDeclarations, function (portDeclaration) {
        return portDeclaration.toString().includes(':');
    });
    if (compositionExportsAnyExplicitPorts) {
        throw new Error("Composition cannot explicitly export any ports");
    }
}

function validateVolumes(compositionObject) {
    var collectedDeclarations = [];
    declarationInComposition(collectedDeclarations, compositionObject, 'volumes');
    collectedDeclarations = _.flatten(collectedDeclarations, true);
    var localFilesystemVolumes = _.some(collectedDeclarations, function (volumeDeclaration) {
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

function declarationInComposition(collectedDeclarations, object, declaration) {
    if (_.has(object, declaration)) {
        var declarations = object[declaration];
        if (Array.isArray(declarations)) {
            collectedDeclarations.push(declarations);
        }
    }
    _.map(object, function (v) {
        if (typeof v === "object") {
            declarationInComposition(collectedDeclarations, v, declaration);
        }
    });
}