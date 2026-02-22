import QtQuick
import QtQuick.Controls
import QtWebEngine

WebEngineView {
    id: webView
    anchors.fill: parent

    // Scope for navigation enforcement (empty = no restriction)
    property string appScope: ""

    // Signal to parent to open URL in new tab
    signal openInNewTab(string url)
    // Signal to parent to open a window request in new tab (preserves window.opener)
    signal openRequestInNewTab(var request)

    // Check if a URL is within the app scope
    function isInScope(urlString) {
        if (appScope.length === 0) return true
        try {
            var scopeUrl = new URL(appScope)
            var targetUrl = new URL(urlString)
            // Same origin check
            if (scopeUrl.origin !== targetUrl.origin) return false
            // Path prefix check
            return targetUrl.pathname.indexOf(scopeUrl.pathname) === 0
        } catch(e) {
            return true  // If URL parsing fails, allow navigation
        }
    }

    onLoadingChanged: function(loadRequest) {
        if (loadRequest.status === WebEngineView.LoadFailedStatus) {
            console.error("Load failed:", loadRequest.errorString)
        }
    }

    // Intercept new window requests → new tab with opener relationship
    onNewWindowRequested: function(request) {
        webView.openRequestInNewTab(request)
    }

    onNavigationRequested: function(request) {
        // Always allow back/forward/reload
        if (request.navigationType === WebEngineNavigationRequest.BackForwardNavigation ||
            request.navigationType === WebEngineNavigationRequest.ReloadNavigation) {
            request.action = WebEngineNavigationRequest.AcceptRequest
            return
        }
        // For link clicks and form submissions, check scope
        var reqUrl = request.url.toString()
        if (!isInScope(reqUrl)) {
            request.action = WebEngineNavigationRequest.IgnoreRequest
            Qt.openUrlExternally(reqUrl)
            return
        }
        request.action = WebEngineNavigationRequest.AcceptRequest
    }

    onContextMenuRequested: function(request) {
        request.accepted = true
        contextMenu.linkUrl = request.linkUrl.toString()
        contextMenu.selectedText = request.selectedText
        contextMenu.mediaUrl = request.mediaUrl.toString()
        contextMenu.canGoBack = webView.canGoBack
        contextMenu.canGoForward = webView.canGoForward
        contextMenu.popup()
    }

    Menu {
        id: contextMenu

        property string linkUrl: ""
        property string selectedText: ""
        property string mediaUrl: ""
        property bool canGoBack: false
        property bool canGoForward: false

        // ── Navigation ──────────────────────────────────
        MenuItem {
            text: "Back"
            enabled: contextMenu.canGoBack
            onTriggered: webView.goBack()
        }

        MenuItem {
            text: "Forward"
            enabled: contextMenu.canGoForward
            onTriggered: webView.goForward()
        }

        MenuItem {
            text: "Reload"
            onTriggered: webView.reload()
        }

        MenuSeparator {
            visible: contextMenu.linkUrl.length > 0
        }

        // ── Link actions ────────────────────────────────
        MenuItem {
            text: "Open link in new tab"
            visible: contextMenu.linkUrl.length > 0
            onTriggered: webView.openInNewTab(contextMenu.linkUrl)
        }

        MenuItem {
            text: "Copy link address"
            visible: contextMenu.linkUrl.length > 0
            onTriggered: {
                webView.triggerWebAction(WebEngineView.CopyLinkToClipboard)
            }
        }

        MenuSeparator {
            visible: contextMenu.selectedText.length > 0
        }

        // ── Text actions ────────────────────────────────
        MenuItem {
            text: "Copy"
            visible: contextMenu.selectedText.length > 0
            onTriggered: webView.triggerWebAction(WebEngineView.Copy)
        }

        MenuSeparator {
            visible: contextMenu.mediaUrl.length > 0
        }

        // ── Image actions ───────────────────────────────
        MenuItem {
            text: "Copy image"
            visible: contextMenu.mediaUrl.length > 0
            onTriggered: webView.triggerWebAction(WebEngineView.CopyImageToClipboard)
        }

        MenuItem {
            text: "Copy image address"
            visible: contextMenu.mediaUrl.length > 0
            onTriggered: webView.triggerWebAction(WebEngineView.CopyImageUrlToClipboard)
        }
    }
}
