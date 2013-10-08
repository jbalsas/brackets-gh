/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50, node: true */
/*global brackets */
(function () {
    "use strict";

    var async       = require("async"),
        base        = require("gh/lib/base"),
        Issue       = require("gh/lib/cmds/issue").Impl,
        User        = require("gh/lib/cmds/user").Impl,
        git         = require("gh/lib/git");

    // The node domain manager
    var _domainManager = null;
    
    // Root path for gh operations
    var _path = null;
    
    /**
     * Helper function for running gh commands. Executes basic operations to
     * extract information based on the current project path, and executes
     * the given command after that
     * @param {Function} cb Callback function to notify initialization errors
     * @param {object} options Options object with the parameters of the command
     * @param {Function} command The command to be executed
     */
    function _initHelper(cb, options, command) {
        var operations  = [];
        
        options.remote = options.remote || base.config.default_remote;

        if (!_path) {
            cb("Path has not been initialized!");
        }
        
        // Set ourselves on the project path so all gh operations have proper context
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

            // Execute the supplied command
            command(options);
        });
    }
    
    /**
     * Sets the path base for all gh commands. The path must be a subfolder of a GitHub
     * hosted git project. It's not mandatory that the path is the root folder of it.
     * @param {string} path Absolute path of the project
     * @param {Function} cb Callback function to notify the result
     */
    function _cmdSetPath(path, cb) {
        _path = path;
        
        _initHelper(cb, {}, function(options) {
            cb(null, options);
        });
    }
    
    /**
     * Retrieves a list of issues in the repository
     * @param {string.<open|closed>} state State of the issue. Can be "open" or "closed"
     * @param {boolean} assignee User assigned to the issue
     * @param {Function} cb Callback function to notify initialization errors
     */
    function _cmdListIssues(state, assignee, cb) {

        // Normalize parameters
        if (arguments.length == 1) {
            cb = arguments[0];
            state = Issue.STATE_OPEN;
        } else if (arguments.length == 2) {
            cb = arguments[1];
            assignee = false;
        }

        var options = {
                all: true,
                state: state
            };

        _initHelper(cb, options, function(options) {
            if (assignee) {
                options.assignee = options.loggedUser;
            }
            
            var issues = new Issue(options);
            
            issues.list(options.remoteUser, options.repo, function(err, result) {
                cb(err, result);
            });
        });
    }
    
    /**
     * Creates a new issue
     * @param {string} title Title of the new issue
     * @param {string} message Body of the new issue 
     * @param {Function} cb Callback function to notify initialization errors
     */
    function _cmdNewIssue(title, message, cb) {
        
        // Normalize parameters
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
                cb(err, result);
            });
        });
    }
    
    /**
     * Closes an open issue
     * @param {number} number Number of the issue in the repository
     * @param {Function} cb Callback function to notify initialization errors
     */
    function _cmdCloseIssue(number, cb) {
        
        // Normalize parameters
        if (arguments.length < 2) {
            arguments[arguments.length - 1]("MISSING PARAMS");
            return;
        }
        
        var options = {
            number: number
        };
        
        _initHelper(cb, options, function(options) {
            var issues = new Issue(options);
            
            issues.close(function(err, result) {
                cb(err, result);
            });
        });
    }
            
    /**
     * Comments on an issue
     * @param {number} number Number of the issue in the repository
     * @param {string} comment Comment on the new issue
     * @param {Function} cb Callback function to notify initialization errors
     */
    function _cmdCommentIssue(number, comment, cb) {
        
        // Normalize arguments
        if (arguments.length < 3) {
            arguments[arguments.length - 1]("MISSING PARAMS");
            return;
        }
        
        var options = {
            comment: comment,
            number: number
        };
        
        _initHelper(cb, options, function(options) {
            var issues = new Issue(options);
            
            issues.comment(function(err, result) {
                cb(err, result);
            });
        });
    }
    
    /**
     * Gets an issue comments
     * @param {number} number Number of the issue in the repository
     * @param {Function} cb Callback function to notify initialization errors
     */
    function _cmdGetComments(number, cb) {
        
        // Normalize arguments
        if (arguments.length < 2) {
            arguments[arguments.length - 1]("MISSING PARAMS");
            return;
        }
        
        var options = {
            number: number
        };
        
        _initHelper(cb, options, function(options) {
            base.github.issues.getComments({
                number: options.number,
                repo: options.repo,
                user: options.user
            }, function (err, result) {
                cb(err, result);
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
        
        // Sets the path base for all gh commands
        _domainManager.registerCommand(
            "gh",
            "setPath",
            _cmdSetPath,
            true,
            "Sets the path base for all gh commands. The path must be a subfolder of a GitHub hosted git project. It's not mandatory that the path is the root folder of it",
            [{
                name: "path",
                type: "string",
                description: "Absolute path of the project"
            }],
            [{
                name: "result",
                type: "object",
                description: "The result of the execution"
            }],
            []
        );

        // Retrieves a list of issues in the repository
        _domainManager.registerCommand(
            "gh",
            "listIssues",
            _cmdListIssues,
            true,
            "Retrieves a list of issues in the repository",
            [{
                name: "state",
                type: "string",
                description: "State of the issue. Can be 'open' or 'closed'"
            },{
                name: "assignee",
                type: "string",
                description: "User assigned to the issue"
            }],
            [{
                name: "result",
                type: "object",
                description: "The result of the execution"
            }],
            []
        );
        
        // Creates a new issue
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
                description: "Body of the issue"
            }],
            [{
                name: "result",
                type: "object",
                description: "The result of the execution"
            }],
            []
        );
        
        // Closes an open issue
        _domainManager.registerCommand(
            "gh",
            "closeIssue",
            _cmdCloseIssue,
            true,
            "Closes an existing issue",
            [{
                name: "number",
                type: "number",
                description: "Number of the issue in the repository"
            }],
            [{
                name: "result",
                type: "object",
                description: "The result of the execution"
            }],
            []
        );
        
        // Comments on an issue
        _domainManager.registerCommand(
            "gh",
            "commentIssue",
            _cmdCommentIssue,
            true,
            "Closes an existing issue",
            [{
                name: "number",
                type: "number",
                description: "Number of the issue in the repository"
            },{
                name: "comment",
                type: "string",
                description: "Comment on the new issue"
            }],
            [{
                name: "result",
                type: "object",
                description: "The result of the execution"
            }],
            []
        );
        
        // Comments on an issue
        _domainManager.registerCommand(
            "gh",
            "getComments",
            _cmdGetComments,
            true,
            "Gets an issue comments",
            [{
                name: "number",
                type: "number",
                description: "Number of the issue in the repository"
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