/*jslint vars: true, plusplus: true, devel: true, nomen: true, indent: 4, maxerr: 50, browser: true */
/*global $, define, brackets, Mustache */

define(function (require, exports, module) {
    "use strict";
    
    var CommandManager          = brackets.getModule("command/CommandManager"),
        Menus                   = brackets.getModule("command/Menus"),
        EditorManager           = brackets.getModule("editor/EditorManager"),
        ProjectManager          = brackets.getModule("project/ProjectManager"),
        AppInit                 = brackets.getModule("utils/AppInit"),
        ExtensionUtils          = brackets.getModule("utils/ExtensionUtils"),
        NodeConnection          = brackets.getModule("utils/NodeConnection"),
        Dialogs                 = brackets.getModule("widgets/Dialogs"),
        ErrorTokenNotFoundTPL   = require("text!htmlContent/error-token-not-found.html"),
        IssueCommentTPL         = require("text!htmlContent/issue-comment.html"),
        IssueCommentInputTPL    = require("text!htmlContent/issue-comment-input.html"),
        IssueDialogNewTPL       = require("text!htmlContent/issue-dialog-new.html"),
        IssueDialogViewTPL      = require("text!htmlContent/issue-dialog-view.html"),
        IssuePanelTPL           = require("text!htmlContent/issue-panel.html"),
        IssueParticipantsTPL    = require("text!htmlContent/issue-participants.html"),
        IssueTableRowTPL        = require("text!htmlContent/issue-table-row.html");
    
    var marked  = require("third_party/marked"),
        moment  = require("third_party/moment");
    
    var CMD_GH_ISSUES_LIST  = "gh_issues_list";
    var CMD_GH_ISSUES_NEW   = "gh_issues_new";

    var nodeConnection;
    
    var contextMenu     = Menus.getContextMenu(Menus.ContextMenuIds.PROJECT_MENU),
        menuItems       = [],
        buildMenuItem   = null;
    
    // Current git repo information based on the project path
    var ghRepoInfo = {};
    
    // Shortcut to gh domain
    var gh;
    
    // UI Elements
     var $issuesPanel,
         $issuesWrapper,
         $issuesList;
    
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
    
    // Helper function to check if the github panel is open
    function _isPanelOpen() {
        return $issuesPanel.is(":visible");
    }
    
    // Handles toggling the panel
    function _togglePanel() {
        
        if (_isPanelOpen()) {
            $issuesPanel.hide();
        } else {
            $issuesPanel.show();
            _listIssues();
        }
        
        EditorManager.resizeEditor();
        
        CommandManager.get(CMD_GH_ISSUES_LIST).setChecked(_isPanelOpen());
    }
    
    //
    function _showTokenMessage() {
        Dialogs.showModalDialogUsingTemplate(
            Mustache.render(ErrorTokenNotFoundTPL, {extensionPath: ExtensionUtils.getModulePath(module, "")})
        );
    }
    
    // Starts the new issue workflow
    function _createIssue() {        
        var dialog = Dialogs.showModalDialogUsingTemplate(
            Mustache.render(IssueDialogNewTPL, ghRepoInfo)
        );
        
        var submitClass     = "gh-create",
            cancelClass     = "gh-cancel",
            $dialogBody     = dialog.getElement().find(".modal-body"),
            $title          = $dialogBody.find(".gh-issue-title").focus(),
            $message        = $dialogBody.find(".gh-issue-message");
        
        $dialogBody.delegate(".btn", "click", function(event) {
            var $btn = $(event.currentTarget);
            
            if ($btn.hasClass(cancelClass)) {
                dialog.close();
            } else if ($btn.hasClass(submitClass)) {
                $dialogBody.toggleClass("loading");

                gh.newIssue($title.val(), $message.val()).done(function(issue) {
                    if (issue && issue.html_url) {
                        dialog.close();
                        _viewIssue(issue);
                    } else {
                        $dialogBody.toggleClass("error loading");
                    }
                });
            }
        });        
    }
    
    // Open the detailed issue dialog
    function _viewIssue(issue) {
        
        issue.state_class = issue.state === "open" ? "success" : "error";
        issue.body = marked(issue.body);

        var dialog = Dialogs.showModalDialogUsingTemplate(
            Mustache.render(IssueDialogViewTPL, issue)
        );

        gh.getComments(issue.number).done(function(result) {
            var $dialog             = dialog.getElement(),
                $dialogBody         = $dialog.find(".modal-body"),
                $conversation       = $dialog.find(".issue-conversation"),
                $participants       = $dialog.find(".issue-participants"),
                $commentInputPanel  = $dialog.find(".issue-comment-input"),
                participantsList    = [],
                participantsMap     = {};
                        
            result.forEach(function(comment) {
                participantsMap[comment.user.login] = comment.user;
                
                comment.created_at = moment(comment.created_at).fromNow();
                comment.body = marked(comment.body);
                
                $conversation.append(Mustache.render(IssueCommentTPL, comment));
            });
            
            participantsMap[issue.user.login] = issue.user;
            
            participantsList = $.map(participantsMap, function(participant) {
                return participant.avatar_url;
            });
            
            $participants.append(Mustache.render(IssueParticipantsTPL, {participants: participantsList} ));

            $commentInputPanel.append(Mustache.render(IssueCommentInputTPL, {}));
            
            var $commentInput   = $commentInputPanel.find(".comment-body"),
                $commentPreview = $commentInputPanel.find(".comment-preview");

            $commentInputPanel.find('a[data-action="preview"]').on("shown", function (event) {
                $commentPreview.html(marked($commentInput.val()));
            });
            
            $commentInputPanel.find(".btn-success").on("click", function(event) {
                $dialogBody.addClass("loading");
                
                nodeConnection.domains.gh.commentIssue(issue.number, $commentInput.val())
                    .done(function(comment) {
                        // Append the new comment
                        comment.created_at = moment(comment.created_at).fromNow();
                        comment.body = marked(comment.body);
                
                        $conversation.append(Mustache.render(IssueCommentTPL, comment));
                        
                        // Empty the input and select the Write tab
                        $commentInput.val("");
                        
                        if ($commentInputPanel.find(".nav-tabs li.active a").data("action") === "preview") {
                            $commentInputPanel.find(".nav-tabs li:first-child a").tab("show")
                        }
                        
                        $dialogBody.removeClass("loading");
                    })
                    .fail(function(err) {
                        console.log("ERR: " + err);
                    });
            });
            
            $commentInputPanel.find(".btn-close").on("click", function(event) {
                $dialogBody.addClass("loading");
                
                nodeConnection.domains.gh.closeIssue(issue.number).done(function(data) {
                    $dialog.removeClass("state-open").addClass("state-closed");
                    $dialogBody.removeClass("loading");
                })
                .fail(function(err) {
                    console.log("ERR: " + err);
                });
            });
            
            $commentInputPanel.find(".btn-reopen").on("click", function(event) {
                $dialogBody.addClass("loading");
                
                nodeConnection.domains.gh.reopenIssue(issue.number).done(function(data) {
                    $dialog.removeClass("state-closed").addClass("state-open");
                    $dialogBody.removeClass("loading");
                })
                .fail(function(err) {
                    console.log("ERR: ");
                    console.log(err);
                });
            });

            $dialogBody.removeClass("loading");
        }).fail(function(err) {
            console.log(err);
            
            $dialogBody.removeClass("loading");
        });
    }
    
    // Retrieves the list of issues for the repo
    function _listIssues() {
        var state       = $issuesPanel.find(".issue-state.disabled").data("state"),
            assignee    = $issuesPanel.find(".issue-assignee.disabled").data("assignee") == "own";
        
        $issuesWrapper.addClass("loading");
        $issuesList.empty();

        gh.listIssues(state, assignee).done(function(data) {
            data.issues.forEach(function(issue) {

                issue.created_at = moment(issue.created_at).fromNow();
                
                var data = {
                    githubLogo: githubLogo,
                    issue: issue
                }

                var $row = $(Mustache.render(IssueTableRowTPL, data));
                
                $row.data("issue", issue);
                
                $issuesList.append($row);
                
                $issuesWrapper.removeClass("loading");
            });
        });
    }
    
    // Initializes and and binds the events on the Issues Panel
    function _initializeIssuesPanel() {
        var $content    = $(".content").append(Mustache.render(IssuePanelTPL, ghRepoInfo));
            
        $issuesPanel    = $content.find(".gh-issue-panel");
        $issuesWrapper  = $issuesPanel.find(".gh-issues-wrapper");
        $issuesList     = $issuesPanel.find(".gh-issues-list");
        
        $issuesList.delegate("tr.gh-issue", "click", function(event) {
            var targetLocalName = $(event.target).context.localName;
            
            if(targetLocalName !== "a" && targetLocalName !== "i") {
                _viewIssue($(event.currentTarget).data("issue"));
            }
        });
        
        $issuesWrapper.find(".close").on("click", _togglePanel);

        $issuesWrapper.delegate(".btn.issue-state", "click", function(event) {
            var $target = $(event.currentTarget);
            
            if (!$issuesWrapper.hasClass("loading") && !$target.hasClass("disabled")) {
                $issuesWrapper.find(".btn.issue-state").toggleClass("disabled");
                _listIssues();
            }
        });
        
        $issuesWrapper.delegate(".btn.issue-assignee", "click", function(event) {
            var $target = $(event.currentTarget);
            
            if (!$issuesWrapper.hasClass("loading") && !$target.hasClass("disabled")) {
                $issuesWrapper.find(".btn.issue-assignee").toggleClass("disabled");
                _listIssues();
            }
        });
    }
    
    //
    function _initializeUI() {
        // Load de CSS styles and initialize the HTML content
        ExtensionUtils.loadStyleSheet(module, "css/font-awesome.css");
        ExtensionUtils.loadStyleSheet(module, "css/styles.css").done(function () {
            _initializeIssuesPanel();
        });        
    }
    
    //
    function _initialize(hasToken) {
        var initFunction    = hasToken ? _initializeUI : function() {},
            commandFunction = hasToken ? _togglePanel : _showTokenMessage,
            menu            = Menus.getMenu(Menus.AppMenuBar.VIEW_MENU);
        
        initFunction();
        
        CommandManager.register("Github Issues", CMD_GH_ISSUES_LIST, commandFunction);
        menu.addMenuDivider();
        menu.addMenuItem(CMD_GH_ISSUES_LIST, "", Menus.LAST);
        
        if (hasToken) {
            CommandManager.register("New Issue", CMD_GH_ISSUES_NEW, _createIssue);
            menu.addMenuItem(CMD_GH_ISSUES_NEW, "", Menus.LAST);
        }        
    }
    
    // Initialize brackets-gh extension and node domain
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

            loadPromise.then(function(){
                gh = nodeConnection.domains.gh;
                gh.setPath(projectPath).done(function(repoInfo) {
                    ghRepoInfo = repoInfo;
                    _initialize(true);
                }).fail(function(err){
                    _initialize(false);
                });
            }).fail(function (error) {
                console.log("[brackets-gh] failed to load gh domain");
                console.log(error);
            });

            return loadPromise;
        }

        chain(connect, loadGHDomain);
        
        $(ProjectManager).on("projectOpen", function (event, projectRoot) {
            nodeConnection.domains.gh.setPath(projectRoot.fullPath).done(function(repoInfo) {
                ghRepoInfo = repoInfo;
                
                var repo    = repoInfo.user + "/" + repoInfo.repo,
                    repoURL = "http://github.com/" + repo;

                $issuesWrapper.find(".title .repo a").html(repo).attr("href", repoURL);
                
                if (_isPanelOpen()) {
                    _listIssues();
                }
            });
        });        
    });
});