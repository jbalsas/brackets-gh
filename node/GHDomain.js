/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50, node: true */
/*global brackets */
(function () {
    "use strict";

    var issueImpl   = require("gh/lib/cmds/issue").Impl;

    var _domainManager = null;
    
    /**
     * Lists issues
     */
    function _cmdListIssues(cb) {
        var options = { all: true, state: "open" },
            issues  = new issueImpl(options);

        issues.list("adobe", "brackets", function(err, result) {
            cb(null, result);
        });
    }
    
    /**
     * Initializes the GH domain with its commands.
     * @param {DomainManager} domainManager The DomainManager
     */
    function init(domainManager) {
        _domainManager = domainManager;

        if (!_domainManager.hasDomain("gh")) {
            _domainManager.registerDomain("gh", {major: 0, minor: 1});
        }
        
        _domainManager.registerCommand(
            "gh",
            "listIssues",
            _cmdListIssues,
            true,
            "Gets a list of issues",
            [{
                name: "state",
                type: "string",
                description: "State of issues to list"
            }],
            [{name: "result",
                type: "object",
                description: "The result of the execution"
            }],
            []
        );
    }
    
    exports.init = init;
    
}());