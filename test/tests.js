var expect      = require('chai').expect;
var path        = require('path');
var _           = require('lodash');
var YAML        = require('yamljs');

var Transformer = require('../lib/transformer');

var tests_docker_compose = [
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
    }
];
describe("compose", function() {

    describe("transfer", function () {

        describe("docker compose", function () {

            _.forEach(tests_docker_compose, function(test) {

                it(test.name, function(done) {

                    var transformer = new Transformer({
                        file: path.join(__dirname, test.file)
                    });

                    transformer.toDockerCompose()
                        .then(function(result) {

                            result = YAML.parse(result);

                            if (test.expected) {
                                console.log(JSON.stringify(result, null, 2));
                            }

                            expect(result).to.deep.equal(test.expected);
                        })
                        .done(done, done);
                });
            });
        });
    });
});