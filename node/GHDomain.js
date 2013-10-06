/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50, node: true */
/*global brackets */
(function () {
    "use strict";

    var async       = require("async"),
        base        = require("gh/lib/base"),
        git         = require("gh/lib/git"),
        Issue       = require("gh/lib/cmds/issue").Impl,
        User        = require("gh/lib/cmds/user").Impl;

    var _domainManager = null;
    
    var _path = null;
    
    /**
     * Helper function for running gh commands
     * @param cb
     * @param command
     */
    function _initHelper(cb, options, command) {
        var operations  = [];
        
        options.remote = options.remote || base.config.default_remote;

        if (!_path) {
            cb("Path has not been initialized!");
        }
        
        process.chdir(_path);        
        
        operations.push(User.login);
        
        operations.push(function(callback) {
            git.getUser(options.remote, callback);
        });
    
        operations.push(function(callback) {
            git.getRepo(options.remote, callback);
        });
    
        operations.push(git.getCurrentBranch);
        
        async.series(operations, function(err, results) {
            options.loggedUser = base.getUser();
            options.remoteUser = results[1];
    
            if (!options.user) {
                if (options.repo || options.all) {
                    options.user = options.loggedUser;
                }
                else {
                    options.user = options.remoteUser || options.loggedUser;
                }
            }
    
            options.repo = options.repo || results[2];
            options.currentBranch = options.currentBranch || results[3];

            command(options);
        });
    }
    
    /**
     * Path setter for all gh commands
     * @param path
     */
    function _cmdSetPath(path) {
        _path = path;
    }
    
    /**
     * Lists issues
     * @param cb
     */
    function _cmdListIssues(state, assignee, cb) {
        if (arguments.length == 1) {
            cb = arguments[0];
            state = Issue.STATE_OPEN;
        } else if (arguments.length == 2) {
            cb = arguments[1];
            assignee = false;
        }

        var issues,
            options = {
                all: true,
                state: state
            };

        _initHelper(cb, options, function(options) {
            if (assignee) {
                options.assignee = options.loggedUser;
            }
            
            issues = new Issue(options);
            
            issues.list(options.remoteUser, options.repo, function(err, result) {
                cb(null, result);
            });
        });
    }
    
    /**
     *
     */
    function _cmdNewIssue(title, message, cb) {
        if (arguments.length < 3) {
            arguments[arguments.length - 1]("MISSING PARAMS");
            return;
        }
        
        var options = {
            message: message,
            title: title
        };
        
        _initHelper(cb, options, function(options) {
            var issues = new Issue(options);
            
            issues.new(function(err, result) {
                cb(null, result);
            });
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
        
        // 
        _domainManager.registerCommand(
            "gh",
            "setPath",
            _cmdSetPath,
            false,
            "Sets the path",
            [{
                name: "path",
                type: "string",
                description: "Path for the gh commands"
            }],
            [],
            []
        );

        // 
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
            },{
                name: "assignee",
                type: "string",
                description: "Assigned person"
            }],
            [{
                name: "result",
                type: "object",
                description: "The result of the execution"
            }],
            []
        );
        
        // 
        _domainManager.registerCommand(
            "gh",
            "newIssue",
            _cmdNewIssue,
            true,
            "Creates a new issue",
            [{
                name: "title",
                type: "string",
                description: "Title of the new issue"
            },{
                name: "message",
                type: "string",
                description: "Message of the issue"
            }],
            [{
                name: "result",
                type: "object",
                description: "The result of the execution"
            }],
            []
        );
    }
    
    exports.init = init;
    
}());