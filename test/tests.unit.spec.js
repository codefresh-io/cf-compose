var expect = require('chai').expect;
var path = require('path');
var _ = require('lodash');
var Q = require('q');
var YAML = require('yamljs');

var Transformer = require('../lib/transformer');

var tests_docker_compose = [
    {
        name: 'handlers',
        file: 'config/handlers.yml',
        handlers: {
            service: function (info) {
                var result = info.result;
                _.forEach(result, function (item) {
                    delete item.service;
                    item.image = 'this is image';
                });
                return Q.resolve();
            }
        },
        expected: {
            "service1": {
                "image": "this is image"
            }
        }
    },
    {
        name: 'routing simple',
        file: 'config/routing-simple.yml',
        expected: {
            "lb": {
                "image": "lb"
            },
            "service1": {
                "image": "service",
                "environment": {
                    "VIRTUAL_HOST": "http://*/test1",
                    "VIRTUAL_HOST_WEIGHT": 3
                }
            },
            "service2": {
                "image": "service",
                "environment": {
                    "VIRTUAL_HOST": "http://*/test2",
                    "VIRTUAL_HOST_WEIGHT": 2
                }
            },
            "service3": {
                "image": "service",
                "environment": {
                    "VIRTUAL_HOST": "http://*/*",
                    "VIRTUAL_HOST_WEIGHT": 1
                }
            }
        }
    }, {
        name: 'routing tcp',
        file: 'config/routing-tcp.yml',
        expected: {
            "lb": {
                "image": "lb",
                "links": [
                    "mongo"
                ]
            },
            "mongo": {
                "image": "mongo",
                "environment": {
                    "TCP_PORTS": "27017"
                }
            }
        }
    }, {
        name: 'extended',
        file: 'config/extended.yml',
        expected: {
            "lb": {
                "image": "codefresh/cf-lb:develop",
                "links": [
                    "ui1",
                    "ui2",
                    "api1",
                    "api2"
                ],
                "ports": [
                    "80:80"
                ]
            },
            "ui1": {
                "image": "codefresh/cf-ui:develop",
                "environment": {
                    "VIRTUAL_HOST": "http://*/*",
                    "VIRTUAL_HOST_WEIGHT": 1
                }
            },
            "ui2": {
                "image": "codefresh/cf-ui:develop",
                "environment": {
                    "VIRTUAL_HOST": "http://*/*",
                    "VIRTUAL_HOST_WEIGHT": 1
                }
            },
            "api1": {
                "image": "codefresh/cf-api:develop",
                "links": [
                    "cfqueue:queue.server",
                    "mongo:mongo"
                ],
                "environment": {
                    "MONGO_URI": "mongo:27017/local",
                    "HOOK_CALLBACK_BUILD": null,
                    "HOOK_GITHUB_URL": null,
                    "HOOK_BITBUCKET_URL": null,
                    "VIRTUAL_HOST": "http://*/api/*",
                    "VIRTUAL_HOST_WEIGHT": 2
                }
            },
            "api2": {
                "image": "codefresh/cf-api:develop",
                "links": [
                    "cfqueue:queue.server",
                    "mongo:mongo"
                ],
                "environment": {
                    "MONGO_URI": "mongo:27017/local",
                    "HOOK_CALLBACK_BUILD": null,
                    "HOOK_GITHUB_URL": null,
                    "HOOK_BITBUCKET_URL": null,
                    "VIRTUAL_HOST": "http://*/api/*",
                    "VIRTUAL_HOST_WEIGHT": 2
                }
            },
            "rt1": {
                "image": "codefresh/cf-runtime:develop",
                "links": [
                    "cfqueue:queue.server"
                ],
                "volumes": [
                    "/var/run/docker.sock:/var/run/docker.sock",
                    "/Users/Shared/tmp/codefresh/builds/:/builds/",
                    "/Users/Shared/tmp/codefresh/cache/:/cache/"
                ],
                "privileged": true,
                "environment": {
                    "ACCOUNT": "codefresh",
                    "RUNTIME_ID": "rt1",
                    "BUILD_PATH_ON_RUNTIME_MACHINE": "/builds/",
                    "BUILD_PATH_ON_RUNTIME_HOST": "/Users/Shared/tmp/codefresh/builds/",
                    "CACHE_PATH": "/cache/"
                }
            },
            "rt2": {
                "image": "codefresh/cf-runtime:develop",
                "links": [
                    "cfqueue:queue.server"
                ],
                "volumes": [
                    "/var/run/docker.sock:/var/run/docker.sock",
                    "/Users/Shared/tmp/codefresh/builds/:/builds/",
                    "/Users/Shared/tmp/codefresh/cache/:/cache/"
                ],
                "privileged": true,
                "environment": {
                    "ACCOUNT": "codefresh",
                    "RUNTIME_ID": "rt2",
                    "BUILD_PATH_ON_RUNTIME_MACHINE": "/builds/",
                    "BUILD_PATH_ON_RUNTIME_HOST": "/Users/Shared/tmp/codefresh/builds/",
                    "CACHE_PATH": "/cache/"
                }
            },
            "cfqueue": {
                "image": "codefresh/cf-lb:develop",
                "links": [
                    "queue1",
                    "queue2"
                ]
            },
            "queue1": {
                "image": "nats:0.7.2",
                "command": "-D",
                "volumes": [
                    "/bin/echo:/bin/echo"
                ],
                "environment": {
                    "TCP_PORTS": "4222"
                }
            },
            "queue2": {
                "image": "nats:0.7.2",
                "command": "-D --routes=nats-route://ruser:T0pS3cr3t@queue1:6222",
                "volumes": [
                    "/bin/echo:/bin/echo"
                ],
                "links": [
                    "queue1"
                ],
                "environment": {
                    "TCP_PORTS": "4222"
                }
            },
            "mongo": {
                "image": "mongo:latest",
                "command": "mongod --smallfiles",
                "volumes": [
                    "/opt/codefresh/mongo:/data/db"
                ]
            }
        }
    },
    {
        name: 'compose-v2',
        file: 'config/compose-v2.yml',
        expected: {
            "version": "2",
            "services": {
                "redis": {
                    "image": "redis",
                    "networks": [
                        "back-tier"
                    ],
                    "volumes": [
                        "redis-data:/var/lib/redis"
                    ]
                },
                "web": {
                    "image": "jim/jimbob",
                    "networks": [
                        "front-tier",
                        "back-tier"
                    ],
                    "ports": [
                        "5000:5000"
                    ],
                    "volumes": [
                        ".:/code"
                    ]
                }
            },
            "volumes": {
                "redis-data": {
                    "driver": "local"
                }
            },
            "networks": {
                "back-tier": {
                    "driver": "bridge"
                },
                "front-tier": {
                    "driver": "bridge"
                }
            }
        }
    }
];
describe("Transform composition", function () {

    describe("From file", function () {

        _.forEach(tests_docker_compose, function (test) {

            it(test.name, function (done) {

                var transformer = new Transformer({
                    file: path.join(__dirname, test.file),
                    handlers: test.handlers
                });

                transformer.fileToCompose()
                    .then(function (result) {

                        result = YAML.parse(result);

                        if (!test.expected) {
                            console.log(JSON.stringify(result, null, 2));
                        }

                        expect(result).to.deep.equal(test.expected);
                    })
                    .done(done, done);
            });
        });
    });

    it("From YAML", function (done) {
        var transformer = new Transformer({
            compositionVars: [{key: 'ASD', value: 'thiisthevalue'}]
        });

        transformer.yamlToCompose('web:\n  image: jim/jimbob\n  ports:\n   - "5000:5000"\n  environment:\n    ASD: $ASD\n')
            .then(function (result) {

                result = YAML.parse(result);
                expect(result).to.deep.equal({"web": {"image": "jim/jimbob", "ports": ["5000:5000"], "environment": {"ASD": "thiisthevalue"}}});
                done();
            })
            .catch(function (err) {
                done(err);
            });
    });

    it("From JSON", function (done) {
        var transformer = new Transformer({
            compositionVars: [{key: 'ASD', value: 'thiisthevalue'}]
        });

        transformer.jsonToCompose('{"web" : {"image" : "jim/jimbob", "ports" : ["6000:6000"], "environment": {"ASD": "$ASD"}}}')
            .then(function (result) {
                result = YAML.parse(result);
                expect(result).to.deep.equal({"web": {"image": "jim/jimbob", "ports": ["6000:6000"], "environment": {"ASD": "thiisthevalue"}}});
                done();
            })
            .catch(function (err) {
                done(err);
            });
    });

    it("From YAML with explicit ports and intrusive validation switched on", function (done) {
        var transformer = new Transformer({
            validateIntrusiveFeatures: true
        });

        transformer.yamlToCompose('web:\n  image: jim/jimbob\n  ports:\n   - "5000:5000"\n')
            .then(function () {
                done("The test should have failed on intrusive feature validation");
            }, function (err) {
                expect(err.message).to.equal("Composition cannot explicitly export any ports");
                done();
            });
    });

    it("From YAML with mounted volumes and intrusive validation switched on", function (done) {
        var transformer = new Transformer({
            validateIntrusiveFeatures: true
        });

        transformer.yamlToCompose('web:\n  image: jim/jimbob\n  volumes:\n   - "/jim/bob:/j/b"\n')
            .then(function () {
                done("The test should have failed on intrusive feature validation");
            }, function (err) {
                expect(err.message).to.equal("Composition cannot mount any volumes");
                done();
            });
    });

    it("From YAML with volumes_from and intrusive validation switched on", function (done) {
        var transformer = new Transformer({
            validateIntrusiveFeatures: true
        });

        transformer.yamlToCompose('web:\n  image: jim/jimbob\n  volumes_from:\n   - "theotherimage"\n')
            .then(function () {
                done("The test should have failed on intrusive feature validation");
            }, function (err) {
                expect(err.message).to.equal("Composition cannot mount any volumes");
                done();
            });
    });

    it("should run transform handler after replacement of composition vars", function () {
        var handlers = {
            image: function (info) {
                expect(info.result.web.environment.ASD).to.equal("thiisthevalue");
            }
        };
        var transformer = new Transformer({
            file: path.join(__dirname, 'config/transform1.yml'),
            handlers: handlers,
            compositionVars: [{key: 'ASD', value: 'thiisthevalue'}]
        });

        var expected = {
            "version": "2",
            "services": {
                "web": {
                    "environment": {
                        "ASD": "thiisthevalue"
                    },
                    "image": "jim/jimbob"
                }
            }
        };

        return transformer.fileToCompose()
            .then(function (result) {

                result = YAML.parse(result);

                expect(result).to.deep.equal(expected);
            });
    });

    it("should replace composition variables even if it is a part of a string", function () {
        var transformer = new Transformer({
            file: path.join(__dirname, 'config/transform2.yml'),
            compositionVars: [{key: 'ASD', value: 'is'}]
        });

        var expected = {
            "version": "2",
            "services": {
                "web": {
                    "environment": {
                        "envvar": "thisisvalue"
                    },
                    "image": "jim/jimbob"
                }
            }
        };

        return transformer.fileToCompose()
            .then(function (result) {

                result = YAML.parse(result);

                expect(result).to.deep.equal(expected);
            });
    });
});