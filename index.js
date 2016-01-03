#!/usr/bin/env node

var fs = require('fs');
var os = require('os');
var path = require('path');
var util     = require('util');

var child_process   = require('child_process');

var Q = require('q');

var Transformer = require('./lib/transformer');

var program = require('commander');

program
    .option('-f, --file FILE', 'Specify an alternate compose file (default: docker-compose.yml)')
    .allowUnknownOption(true)
    .parse(process.argv);

console.log(program);
var file = program.file;
console.log(file);

var convertFile = function() {
    var transformer = new Transformer({
        file: file
    });

    return transformer.toDockerCompose();
}

var createTempFile = function(content) {
    var tmpDir = os.tmpdir();
    var file = path.join('docker-compose-' + Date.now() + '.yml');

    var deferred = Q.defer();
    fs.writeFile(file, content, function(err) {
        if (err) return deferred.reject(err);
        deferred.resolve(file);
    });
    return deferred.promise;
}

var getProjectName = function() {
    return Q.resolve()
    .then(function() {
        var projectName = path.basename(__dirname);
        return projectName;
    });
};

var getComposeCommand = function(file) {
    return getProjectName()
        .then(function(projectName) {
            var runTemplate = '%s  -f %s -p %s up';
            var runCmd = util.format(runTemplate, 'docker-compose', file, projectName);
            return runCmd;
        });
};

var runCompose = function(file) {
    return getComposeCommand(file)
        .then(function(runCmd) {

            var dockerCompose = child_process.exec(runCmd, {
                    encoding: 'utf8',
                    timeout: 0,
                    maxBuffer: 200 * 1024,
                    killSignal: 'SIGTERM',
                    cwd: __dirname,
                    env: null
                },
                function(error) {//jshint ignore:line
                    if (error !== null) {
                        return;
                    }

                    console.log('compose started');
                });

            dockerCompose.stdout.on('data', function(data) {
                console.log(data);
            });
            dockerCompose.stderr.on('data', function(data) {
                console.error(data);
            });

        });
}

convertFile()
    .then(createTempFile.bind(null))
    .then(runCompose.bind(null))
    .catch(function(err) {
        console.error(err);
    });

