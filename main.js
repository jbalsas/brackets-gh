/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50, browser: true */
/*global $, define, brackets, Mustache, hljs */

define(function (require, exports, module) {
    "use strict";
    
    var CommandManager          = brackets.getModule("command/CommandManager"),
        Commands                = brackets.getModule("command/Commands"),
        KeyBindingManager       = brackets.getModule("command/KeyBindingManager"),
        Menus                   = brackets.getModule("command/Menus"),
        EditorManager           = brackets.getModule("editor/EditorManager"),
        ProjectManager          = brackets.getModule("project/ProjectManager"),
        AppInit                 = brackets.getModule("utils/AppInit"),
        ExtensionUtils          = brackets.getModule("utils/ExtensionUtils"),
        NodeConnection          = brackets.getModule("utils/NodeConnection"),
        Dialogs                 = brackets.getModule("widgets/Dialogs"),
        ErrorTokenNotFoundTPL   = require("text!htmlContent/error-token-not-found.html"),
        ErrorProjectNotFoundTPL = require("text!htmlContent/error-project-not-found.html"),
        IssueCommentTPL         = require("text!htmlContent/issue-comment.html"),
        IssueCommentInputTPL    = require("text!htmlContent/issue-comment-input.html"),
        IssueDialogNewTPL       = require("text!htmlContent/issue-dialog-new.html"),
        IssueDialogViewTPL      = require("text!htmlContent/issue-dialog-view.html"),
        IssuePanelTPL           = require("text!htmlContent/issue-panel.html"),
        IssueParticipantsTPL    = require("text!htmlContent/issue-participants.html"),
        IssueTableRowTPL        = require("text!htmlContent/issue-table-row.html");
    
    var ErrorMessageTPL     = "<strong>Ooops... looks like something unexpected happened:</strong> {{status}} {{code}} ({{message}})",
        ErrorNoIssuesTPL    = "We couldn't find any {{state}} issues {{assigned}} on {{user}}/{{repo}}";
    
    var highlight   = require("third_party/highlight/highlight"),
        marked      = require("third_party/marked"),
        moment      = require("third_party/moment");
    
    marked.setOptions({
        highlight: function (code, lang) {
            return hljs.highlight(lang, code).value;
        }
    });
    
    var MENU_BRACKETSGH = "jbalsas.bracketsgh.github";
    
    var CMD_GH_HELP_TOKEN   = "gh_help_token";
    var CMD_GH_ISSUES_LIST  = "gh_issues_list";
    var CMD_GH_ISSUES_NEW   = "gh_issues_new";

    var nodeConnection;
    
    // Current project git repository information
    var currentRepo = {};
    
    // Reference for triggers and listeners
    var $bracketsgh = $(exports);
    
    // Shortcut to gh domain
    var gh;
    
    // UI Elements
    var $issuesPanel,
        $issuesWrapper,
        $issuesList;
    
    // Default Error TPL that will show if none is passed to _showErrorMessage
    var defaultTPL = ErrorTokenNotFoundTPL;
    
    var githubLogo = ExtensionUtils.getModulePath(module, "img/github.png");
    
    // Helper function that chains a series of promise-returning
    // functions together via their done callbacks.
    function chain() {
        var functions = Array.prototype.slice.call(arguments, 0);
        if (functions.length > 0) {
            var firstFunction = functions.shift();
            var firstPromise = firstFunction.call();
            firstPromise.done(function () {
                chain.apply(null, functions);
            });
        }
    }
    
    // Helper function to render a template with Mustache
    // @param {object} tpl The mustache template to be rendered
    // @param {object} data The data to be passed down to the template
    // @return {string} The result of rendering the given template
    function _renderTPL(tpl, data) {
        var path = ExtensionUtils.getModulePath(module, "");
        
        return Mustache.render(tpl, {
            data: data,
            path: path
        });
    }
    
    // Displays an error message
    // @param {string} tpl The error message TPL to show
    function _showErrorMessage(tpl) {
        var extensionPath = ExtensionUtils.getModulePath(module, "");
        
        Dialogs.showModalDialogUsingTemplate(_renderTPL(tpl || defaultTPL));
    }
    
    // Open the detailed issue dialog
    function _viewIssue(issue) {
        
        issue.state_class = issue.state === "open" ? "success" : "error";
        issue.body = marked(issue.body);

        var dialog = Dialogs.showModalDialogUsingTemplate(
            Mustache.render(IssueDialogViewTPL, issue)
        );
        
        var $dialog     = dialog.getElement(),
            $dialogBody = $dialog.find(".modal-body");

        gh.getComments(issue.number).done(function (result) {
            var $conversation       = $dialog.find(".issue-conversation"),
                $participants       = $dialog.find(".issue-participants"),
                $commentInputPanel  = $dialog.find(".issue-comment-input"),
                participantsList    = [],
                participantsMap     = {};
                        
            result.forEach(function (comment) {
                participantsMap[comment.user.login] = comment.user;
                
                comment.created_at = moment(comment.created_at).fromNow();
                comment.body = marked(comment.body);
                
                $conversation.append(Mustache.render(IssueCommentTPL, comment));
            });
            
            participantsMap[issue.user.login] = issue.user;
            
            participantsList = $.map(participantsMap, function (participant) {
                return participant.avatar_url;
            });
            
            $participants.append(Mustache.render(IssueParticipantsTPL, {participants: participantsList}));

            $commentInputPanel.append(Mustache.render(IssueCommentInputTPL, {}));
            
            var $commentInput   = $commentInputPanel.find(".comment-body"),
                $commentPreview = $commentInputPanel.find(".comment-preview");

            $commentInputPanel.find('a[data-action="preview"]').on("shown", function (event) {
                $commentPreview.html(marked($commentInput.val()));
            });
            
            $commentInputPanel.find(".btn-success").on("click", function (event) {
                $dialogBody.addClass("loading");
                
                nodeConnection.domains.gh.commentIssue(issue.number, $commentInput.val())
                    .done(function (comment) {
                        // Append the new comment
                        comment.created_at = moment(comment.created_at).fromNow();
                        comment.body = marked(comment.body);
                
                        $conversation.append(Mustache.render(IssueCommentTPL, comment));
                        
                        // Empty the input and select the Write tab
                        $commentInput.val("");
                        
                        if ($commentInputPanel.find(".nav-tabs li.active a").data("action") === "preview") {
                            $commentInputPanel.find(".nav-tabs li:first-child a").tab("show");
                        }
                        
                        $dialogBody.removeClass("loading");
                    })
                    .fail(function (err) {
                        console.log("ERR: " + err);
                    });
            });
            
            $commentInputPanel.find(".btn-close").on("click", function (event) {
                $dialogBody.addClass("loading");
                
                nodeConnection.domains.gh.closeIssue(issue.number).done(function (data) {
                    $dialog.removeClass("state-open").addClass("state-closed");
                    $dialogBody.removeClass("loading");
                }).fail(function (err) {
                    console.log("ERR: " + err);
                });
            });
            
            $commentInputPanel.find(".btn-reopen").on("click", function (event) {
                $dialogBody.addClass("loading");
                
                nodeConnection.domains.gh.reopenIssue(issue.number).done(function (data) {
                    $dialog.removeClass("state-closed").addClass("state-open");
                    $dialogBody.removeClass("loading");
                }).fail(function (err) {
                    console.log("ERR: ");
                    console.log(err);
                });
            });

            $dialogBody.removeClass("loading");
        }).fail(function (err) {
            console.log(err);
            
            $dialogBody.removeClass("loading");
        });
    }
    
    // Starts the new issue workflow
    function _createIssue() {
        if (currentRepo && currentRepo.repo) {
            var dialog = Dialogs.showModalDialogUsingTemplate(
                Mustache.render(IssueDialogNewTPL, currentRepo)
            );
            
            var submitClass = "gh-create",
                cancelClass = "gh-cancel",
                $dialogBody = dialog.getElement().find(".modal-body"),
                $title      = $dialogBody.find(".gh-issue-title").focus(),
                $message    = $dialogBody.find(".comment-body"),
                $preview    = $dialogBody.find(".comment-preview");
            
            $dialogBody.find('a[data-action="preview"]').on("shown", function (event) {
                $preview.html(marked($message.val()));
            });
            
            $dialogBody.delegate(".btn", "click", function (event) {
                var $btn = $(event.currentTarget);
                
                if ($btn.hasClass(cancelClass)) {
                    dialog.close();
                } else if ($btn.hasClass(submitClass)) {
                    $dialogBody.toggleClass("loading");
    
                    gh.newIssue($title.val(), $message.val()).done(function (issue) {
                        if (issue && issue.html_url) {
                            dialog.close();
                            _viewIssue(issue);
                        } else {
                            $dialogBody.toggleClass("error loading");
                        }
                    });
                }
            });
        } else {
            Dialogs.showModalDialogUsingTemplate(_renderTPL(ErrorProjectNotFoundTPL));
        }
    }
    
    // Cleans up the issues panel
    function _resetIssuesUI() {
        var $noIssues   = $issuesWrapper.find(".no-issues"),
            $noGithub   = $issuesWrapper.find(".no-github"),
            $errors     = $issuesWrapper.find(".errors"),
            $state      = $issuesPanel.find(".issue-state"),
            $assignee   = $issuesPanel.find(".issue-assignee");
        
        $issuesWrapper.removeClass("loading");
        $noIssues.addClass("hide");
        $noGithub.addClass("hide");
        $errors.addClass("hide");
        $state.addClass("disabled");
        $assignee.addClass("disabled");
        
        $issuesList.empty();
    }
    
    // Retrieves the list of issues for the current project
    function _listIssues() {
        var state       = $issuesPanel.find(".issue-state.disabled").data("state"),
            $state      = $issuesPanel.find(".issue-state:not(.active)"),
            assignee    = $issuesPanel.find(".issue-assignee.disabled").data("assignee") === "own",
            $assignee   = $issuesPanel.find(".issue-assignee:not(.active)"),
            $noIssues   = $issuesWrapper.find(".no-issues"),
            $errors     = $issuesWrapper.find(".errors");
        
        _resetIssuesUI();
        
        $issuesWrapper.addClass("loading");

        gh.listIssues(state, assignee).done(function (data) {
            if (data.issues && data.issues.length) {
                data.issues.forEach(function (issue) {
                    issue.created_at = moment(issue.created_at).fromNow();
                    
                    var data = {
                        githubLogo: githubLogo,
                        issue: issue
                    };
    
                    var $row = $(Mustache.render(IssueTableRowTPL, data));
                    
                    $row.data("issue", issue);
                    
                    $issuesList.append($row);
                });
            } else {
                $noIssues.find("span").html(Mustache.render(ErrorNoIssuesTPL,
                    {
                        state: state,
                        assigned: (assignee ? "assigned to you" : ""),
                        user: currentRepo.user,
                        repo: currentRepo.repo
                    }));
                
                $noIssues.removeClass("hide");
            }
            
            $state.removeClass("disabled");
            $assignee.removeClass("disabled");
            $issuesWrapper.removeClass("loading");

        }).fail(function (err) {
            console.log(err);
            $errors.find("span").html(Mustache.render(ErrorMessageTPL, err));
            $errors.removeClass("hide");
            
            $issuesWrapper.removeClass("loading");
        });
    }
    
    // Helper function to check if the github panel is open
    function _isPanelOpen() {
        return $issuesPanel.is(":visible");
    }
    
    // Handles toggling the panel
    function _togglePanel() {
        
        if (_isPanelOpen()) {
            $issuesPanel.hide();
        } else {
            if (currentRepo && currentRepo.repo) {
                $issuesPanel.show();
                _listIssues();
            } else {
                _showErrorMessage(ErrorProjectNotFoundTPL);
            }
        }
        
        EditorManager.resizeEditor();
        
        CommandManager.get(CMD_GH_ISSUES_LIST).setChecked(_isPanelOpen());
    }
    
    // Updates available menu options or commands based on the current project
    // @param {object} event JQuery event triggering the update of the menus
    // @param {string: repo, string: user, ...} data Current repository and user details
    function _updatePanels(event, data) {
        var repo    = data.repo ? (data.user + "/" + data.repo) : "unknown",
            repoURL = data.repo ? ("http://github.com/" + repo) : "#";
        
        $issuesWrapper.find(".title .repo a").html(repo).attr("href", repoURL);
        
        if (_isPanelOpen()) {
            if (data.repo) {
                _listIssues();
            } else {
                _resetIssuesUI();
                $issuesWrapper.find(".no-github").removeClass("hide");
            }
        }
    }
    
    // Updates current project git repository information
    // @param {string: repo, string: user, ...} data Current repository and user details
    function _updateRepo(data) {
        currentRepo = data;
        $bracketsgh.trigger("updateRepo", data);
    }
    
    // Register BracketsGH commands
    function _registerCommands() {
        var menu = Menus.getMenu(MENU_BRACKETSGH);
        
        CommandManager.register("New Issue", CMD_GH_ISSUES_NEW, _createIssue);
        
        menu.addMenuItem(CMD_GH_ISSUES_NEW, "Ctrl-Shift-N", Menus.FIRST);
    }
    
    // Initializes UI listeners on the issues panel
    function _bindIssuesPanel() {
        $issuesList.delegate("tr.gh-issue", "click", function (event) {
            var targetLocalName = $(event.target).context.localName;
            
            if (targetLocalName !== "a" && targetLocalName !== "i") {
                _viewIssue($(event.currentTarget).data("issue"));
            }
        });
        
        $issuesWrapper.find(".close").on("click", _togglePanel);

        $issuesWrapper.delegate(".btn.issue-state", "click", function (event) {
            var $target = $(event.currentTarget);
            
            if (!$issuesWrapper.hasClass("loading") && !$target.hasClass("disabled")) {
                $issuesWrapper.find(".btn.issue-state").toggleClass("disabled").toggleClass("active");
                _listIssues();
            }
        });
        
        $issuesWrapper.delegate(".btn.issue-assignee", "click", function (event) {
            var $target = $(event.currentTarget);
            
            if (!$issuesWrapper.hasClass("loading") && !$target.hasClass("disabled")) {
                $issuesWrapper.find(".btn.issue-assignee").toggleClass("disabled").toggleClass("active");
                _listIssues();
            }
        });
    }
    
    // Initializes basic UI listeners
    function _bindUI() {
        $bracketsgh.on("updateRepo", _updatePanels);
        
        $(ProjectManager).on("projectOpen", function (event, projectRoot) {
            nodeConnection.domains.gh.setPath(projectRoot.fullPath).done(_updateRepo);
        });
        
        _bindIssuesPanel();
    }
    
    // Loads assets and 
    function _initializeUI() {
        var $deferred = $.Deferred();
        
        // Load de CSS styles and initialize the HTML content
        ExtensionUtils.loadStyleSheet(module, "css/font-awesome.css");
        ExtensionUtils.loadStyleSheet(module, "third_party/highlight/github.css");
        ExtensionUtils.loadStyleSheet(module, "css/styles.css").done(function () {
            var $content    = $(".content").append(_renderTPL(IssuePanelTPL, currentRepo));
            
            $issuesPanel    = $content.find(".gh-issue-panel");
            $issuesWrapper  = $issuesPanel.find(".gh-issues-wrapper");
            $issuesList     = $issuesPanel.find(".gh-issues-list");
            
            $deferred.resolve();
        });
        
        return $deferred.promise();
    }
    
    // Initializes the panels, menus and listeners of the extension
    // @param {object} err Error object during the initialization process
    // @param {string: repo, string: user, ...} data Current repository and user details
    function _initialize(err, data) {
        var menu = Menus.addMenu("GitHub", MENU_BRACKETSGH, Menus.AFTER, Menus.AppMenuBar.NAVIGATE_MENU);
        
        _initializeUI().done(function () {
            if (!err) {
                CommandManager.register("Explore Issues\u2026", CMD_GH_ISSUES_LIST, _togglePanel);
            
                menu.addMenuItem(CMD_GH_ISSUES_LIST, "", "");
                CommandManager.get(CMD_GH_ISSUES_LIST).setChecked(false);
                
                _bindUI();
                _registerCommands();
                _updateRepo(data);
            } else {
                CommandManager.register("Generate GitHub Token", CMD_GH_HELP_TOKEN, _showErrorMessage);
                menu.addMenuItem(CMD_GH_HELP_TOKEN, "", "");
            }
        });
    }
    
    // Initialize BracketsGH extension and node domain
    AppInit.appReady(function () {
        nodeConnection = new NodeConnection();
        
        // Helper function that tries to connect to node
        function connect() {
            var connectionPromise = nodeConnection.connect(true);
            
            connectionPromise.fail(function () {
                console.error("[brackets-gh] failed to connect to node");
            });
            
            return connectionPromise;
        }
        
        // Helper function that loads our domain into the node server
        function loadGHDomain() {
            var path        = ExtensionUtils.getModulePath(module, "node/GHDomain"),
                projectPath = ProjectManager.getProjectRoot().fullPath,
                loadPromise = nodeConnection.loadDomains([path], true);

            loadPromise.then(function () {
                gh = nodeConnection.domains.gh;
                
                gh.hasCredentials().done(function (credentials) {
                    if (credentials) {
                        gh.setPath(projectPath).done(function (data) {
                            _initialize(null, data);
                        }).fail(function (err) {
                            _initialize(err);
                        });
                    } else {
                        _initialize("Token needed");
                    }
                });
                
            }).fail(function (err) {
                _initialize(err);
            });

            return loadPromise;
        }

        chain(connect, loadGHDomain);
    });
});