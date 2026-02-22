import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import QtWebEngine
import QtCore
import QAppWrapper

ApplicationWindow {
    id: root
    width: 1024
    height: 768
    visible: true
    title: {
        if (tabModel.count === 0) return root.appId || "QApp"
        var current = tabStack.children[tabBar.currentIndex]
        return current ? (current.title || root.appId) : root.appId
    }

    // argv[0]=binary, argv[1]=app-id, argv[2]=url
    readonly property string appId: Qt.application.arguments.length > 1
        ? Qt.application.arguments[1]
        : "default"
    readonly property string startUrl: Qt.application.arguments.length > 2
        ? Qt.application.arguments[2]
        : "https://example.com"

    Settings {
        id: windowSettings
        category: root.appId
        property alias x: root.x
        property alias y: root.y
        property alias width: root.width
        property alias height: root.height
    }

    // Tab state persistence
    Settings {
        id: tabSettings
        category: root.appId + "/tabs"
        property string savedTabs: ""
    }

    // Profile settings (shared across all wrapper instances)
    Settings {
        id: profileSettings
        category: "profile"
        property int cacheSizeMB: 500
        property int jsHeapSizeMB: 4096
        property string userAgent: ""
    }

    property string _defaultUA: ""

    WebEngineProfile {
        id: appProfile
        storageName: root.appId
        offTheRecord: false
        persistentCookiesPolicy: WebEngineProfile.ForcePersistentCookies
        httpCacheType: WebEngineProfile.DiskHttpCache
        httpCacheMaximumSize: profileSettings.cacheSizeMB * 1048576
    }

    WrapperHelper {
        id: helper
    }

    // ── Display mode properties ─────────────────────────────
    readonly property string effectiveDisplayMode: helper.metadataLoaded ? helper.displayMode : ""
    readonly property bool isBrowserMode: effectiveDisplayMode === "" || effectiveDisplayMode === "browser"
    readonly property bool isStandalone: effectiveDisplayMode === "standalone"
    readonly property bool isMinimalUi: effectiveDisplayMode === "minimal-ui"
    readonly property bool isFullscreen: effectiveDisplayMode === "fullscreen"
    readonly property bool showTabs: isBrowserMode
    readonly property bool showNewTabButton: isBrowserMode
    readonly property bool showSaveAsApp: isBrowserMode

    ListModel {
        id: tabModel
    }

    // ── Save/restore tab state ──────────────────────────────
    function saveTabs() {
        var urls = []
        for (var i = 0; i < tabStack.children.length; i++) {
            var view = tabStack.children[i]
            if (view && view.url)
                urls.push(view.url.toString())
        }
        tabSettings.savedTabs = JSON.stringify(urls)
    }

    function restoreTabs() {
        var urls = []
        try {
            if (tabSettings.savedTabs.length > 0)
                urls = JSON.parse(tabSettings.savedTabs)
        } catch(e) {}

        if (urls.length === 0) {
            addTab(root.startUrl)
        } else {
            for (var i = 0; i < urls.length; i++)
                addTab(urls[i])
        }
    }

    // ── Tab management ──────────────────────────────────────
    function addTab(url) {
        var component = Qt.createComponent("WrapperTab.qml")
        if (component.status === Component.Ready) {
            var scopeUrl = helper.scope || ""
            var view = component.createObject(tabStack, {
                "profile": appProfile,
                "url": url,
                "visible": false,
                "appScope": scopeUrl
            })
            connectTab(view, url)
        }
    }

    // Open a window.open request in a new tab (preserves window.opener)
    function addTabFromRequest(request) {
        var component = Qt.createComponent("WrapperTab.qml")
        if (component.status === Component.Ready) {
            var scopeUrl = helper.scope || ""
            var view = component.createObject(tabStack, {
                "profile": appProfile,
                "visible": false,
                "appScope": scopeUrl
            })
            request.openIn(view)
            connectTab(view, request.requestedUrl.toString())
        }
    }

    function connectTab(view, url) {
        tabModel.append({ "tabTitle": "Loading...", "tabUrl": url })
        var idx = tabModel.count - 1
        view.titleChanged.connect(function() {
            if (idx < tabModel.count)
                tabModel.set(idx, { "tabTitle": view.title || "Untitled" })
        })
        view.openInNewTab.connect(function(newUrl) {
            addTab(newUrl)
        })
        view.openRequestInNewTab.connect(function(req) {
            addTabFromRequest(req)
        })
        // Auto-close tab when window.close() is called (OAuth callback)
        view.windowCloseRequested.connect(function() {
            var tabIdx = -1
            for (var i = 0; i < tabStack.children.length; i++) {
                if (tabStack.children[i] === view) { tabIdx = i; break }
            }
            if (tabIdx >= 0 && tabModel.count > 1) closeTab(tabIdx)
        })
        tabBar.currentIndex = idx
        updateVisibility()
    }

    function closeTab(index) {
        if (tabModel.count <= 1) return  // keep at least one tab
        var view = tabStack.children[index]
        tabModel.remove(index)
        if (view) view.destroy()

        // Fix tab title bindings after removal
        for (var i = 0; i < tabStack.children.length; i++) {
            var v = tabStack.children[i]
            if (v) {
                var capturedIdx = i
                // Rebind title updates
                v.titleChanged.connect(function() {
                    if (capturedIdx < tabModel.count)
                        tabModel.set(capturedIdx, { "tabTitle": v.title || "Untitled" })
                })
            }
        }

        if (tabBar.currentIndex >= tabModel.count)
            tabBar.currentIndex = tabModel.count - 1
        updateVisibility()
        saveTabs()
    }

    function updateVisibility() {
        for (var i = 0; i < tabStack.children.length; i++) {
            var view = tabStack.children[i]
            if (view) view.visible = (i === tabBar.currentIndex)
        }
    }

    Component.onCompleted: {
        // Capture default UA, then apply clean version (strips QtWebEngine tag)
        root._defaultUA = appProfile.httpUserAgent
        appProfile.httpUserAgent = profileSettings.userAgent.length > 0
            ? profileSettings.userAgent
            : root._defaultUA.replace(/QtWebEngine\/[\d.]+ /, "")

        helper.loadMetadata(root.appId)
        restoreTabs()
        if (root.isFullscreen) root.showFullScreen()
    }
    onClosing: saveTabs()

    // ── Theme color helpers ─────────────────────────────────
    function parseHexColor(hex) {
        if (!hex || hex.length < 4) return null
        var c = hex.replace("#", "")
        if (c.length === 3)
            c = c[0]+c[0]+c[1]+c[1]+c[2]+c[2]
        if (c.length !== 6) return null
        var r = parseInt(c.substring(0, 2), 16) / 255.0
        var g = parseInt(c.substring(2, 4), 16) / 255.0
        var b = parseInt(c.substring(4, 6), 16) / 255.0
        return { r: r, g: g, b: b }
    }

    readonly property bool hasThemeColor: helper.themeColor.length > 0
    readonly property var themeRgb: hasThemeColor ? parseHexColor(helper.themeColor) : null
    readonly property bool darkTheme: {
        if (!themeRgb) return false
        var lum = 0.299 * themeRgb.r + 0.587 * themeRgb.g + 0.114 * themeRgb.b
        return lum < 0.5
    }

    // ── Header: TabBar ──────────────────────────────────────
    header: ToolBar {
        id: headerToolBar
        visible: !root.isFullscreen

        background: Rectangle {
            color: root.hasThemeColor ? helper.themeColor : palette.window
        }

        palette.buttonText: root.darkTheme ? "#ffffff" : palette.buttonText
        palette.windowText: root.darkTheme ? "#ffffff" : palette.windowText

        RowLayout {
            anchors.fill: parent
            spacing: 0

            // ── Back/Forward for minimal-ui ──────────────
            ToolButton {
                text: "\u25C0"
                font.pixelSize: 14
                implicitWidth: 36
                visible: root.isMinimalUi
                enabled: {
                    var view = tabStack.children[tabBar.currentIndex]
                    return view ? view.canGoBack : false
                }
                onClicked: {
                    var view = tabStack.children[tabBar.currentIndex]
                    if (view) view.goBack()
                }
            }

            ToolButton {
                text: "\u25B6"
                font.pixelSize: 14
                implicitWidth: 36
                visible: root.isMinimalUi
                enabled: {
                    var view = tabStack.children[tabBar.currentIndex]
                    return view ? view.canGoForward : false
                }
                onClicked: {
                    var view = tabStack.children[tabBar.currentIndex]
                    if (view) view.goForward()
                }
            }

            // ── TabBar (browser mode only) ───────────────
            TabBar {
                id: tabBar
                Layout.fillWidth: true
                visible: root.showTabs

                onCurrentIndexChanged: {
                    updateVisibility()
                    if (tabBar.currentIndex >= 0 && tabBar.currentIndex < tabStack.children.length) {
                        var current = tabStack.children[tabBar.currentIndex]
                        if (current) root.title = current.title || root.appId
                    }
                }

                Repeater {
                    model: tabModel

                    TabButton {
                        width: Math.min(200, tabBar.width / (tabModel.count + 1))
                        contentItem: RowLayout {
                            spacing: 4

                            Label {
                                text: model.tabTitle || "Loading..."
                                elide: Text.ElideRight
                                Layout.fillWidth: true
                                font.pixelSize: 12
                            }

                            ToolButton {
                                text: "\u2715"
                                font.pixelSize: 10
                                implicitWidth: 20
                                implicitHeight: 20
                                visible: tabModel.count > 1
                                onClicked: closeTab(index)
                            }
                        }
                    }
                }
            }

            // ── Spacer for non-tabbed modes ──────────────
            Item {
                Layout.fillWidth: true
                visible: !root.showTabs
            }

            // ── New tab button (browser mode only) ───────
            ToolButton {
                text: "+"
                font.pixelSize: 16
                font.bold: true
                implicitWidth: 36
                visible: root.showNewTabButton
                onClicked: addTab(root.startUrl)
            }

            ToolButton {
                id: hamburgerButton
                text: "\u2630"
                font.pixelSize: 16
                implicitWidth: 36
                onClicked: hamburgerMenu.popup()
            }
        }
    }

    // ── Hamburger menu (F10) ────────────────────────────────
    Shortcut {
        sequence: "F10"
        onActivated: hamburgerMenu.popup()
    }

    // ── Fullscreen toggle (F11) ──────────────────────────
    Shortcut {
        sequence: "F11"
        onActivated: {
            if (root.visibility === ApplicationWindow.FullScreen) {
                root.showNormal()
                headerToolBar.visible = !root.isFullscreen
            } else {
                root.showFullScreen()
                headerToolBar.visible = false
            }
        }
    }

    Menu {
        id: hamburgerMenu

        MenuItem {
            text: "Save as app..."
            visible: root.showSaveAsApp
            height: visible ? implicitHeight : 0
            enabled: !helper.busy && tabBar.currentIndex >= 0
            onTriggered: saveDialog.open()
        }

        MenuSeparator {
            visible: root.showSaveAsApp
            height: visible ? implicitHeight : 0
        }

        Action {
            text: "Settings..."
            onTriggered: settingsDialog.open()
        }

        MenuSeparator {}

        Action {
            text: "About QApp"
            onTriggered: aboutDialog.open()
        }

        Action {
            text: "License (EUPL v1.2)"
            onTriggered: Qt.openUrlExternally("https://eupl.eu/1.2/en/")
        }
    }

    // ── About dialog ────────────────────────────────────────
    Dialog {
        id: aboutDialog
        title: "About QApp"
        anchors.centerIn: parent
        width: 340
        modal: true
        standardButtons: Dialog.Close

        ColumnLayout {
            anchors.fill: parent
            spacing: 12

            Label {
                text: "QApp"
                font.pixelSize: 20
                font.bold: true
                Layout.alignment: Qt.AlignHCenter
            }

            Label {
                text: "Turn any website into a standalone desktop app"
                font.pixelSize: 12
                opacity: 0.7
                Layout.alignment: Qt.AlignHCenter
                wrapMode: Text.WordWrap
                Layout.fillWidth: true
                horizontalAlignment: Text.AlignHCenter
            }

            Label {
                text: "Version 0.1.0-alpha"
                font.pixelSize: 11
                opacity: 0.5
                Layout.alignment: Qt.AlignHCenter
            }

            Rectangle {
                Layout.fillWidth: true
                height: 1
                color: palette.mid
            }

            Label {
                text: "<a href=\"https://northheim.com/\">Northheim</a>"
                font.pixelSize: 12
                Layout.alignment: Qt.AlignHCenter
                onLinkActivated: Qt.openUrlExternally(link)
            }

            Label {
                text: "Licensed under <a href=\"https://eupl.eu/1.2/en/\">EUPL v1.2</a>"
                font.pixelSize: 11
                opacity: 0.6
                Layout.alignment: Qt.AlignHCenter
                onLinkActivated: Qt.openUrlExternally(link)
            }
        }
    }

    // ── Settings dialog ──────────────────────────────────────
    Dialog {
        id: settingsDialog
        title: "Settings"
        anchors.centerIn: parent
        width: 380
        modal: true
        standardButtons: Dialog.Close

        ColumnLayout {
            anchors.fill: parent
            spacing: 16

            Label {
                text: "App: " + root.appId
                font.pixelSize: 13
                opacity: 0.7
            }

            Rectangle {
                Layout.fillWidth: true
                height: 1
                color: palette.mid
            }

            Label {
                text: "Clear all browsing data (cookies, cache, local storage) and return to start page."
                font.pixelSize: 12
                opacity: 0.6
                wrapMode: Text.WordWrap
                Layout.fillWidth: true
            }

            Button {
                text: "Clear data & restart"
                Layout.alignment: Qt.AlignHCenter

                onClicked: {
                    tabSettings.savedTabs = ""
                    helper.clearAppDataAndRestart(root.appId)
                }
            }

            Rectangle { Layout.fillWidth: true; height: 1; color: palette.mid }

            Label {
                text: "Profile"
                font.pixelSize: 14
                font.bold: true
            }

            GridLayout {
                columns: 2
                columnSpacing: 12
                rowSpacing: 8
                Layout.fillWidth: true

                Label { text: "HTTP cache (MB):"; font.pixelSize: 12 }
                SpinBox {
                    id: cacheSpin
                    from: 100
                    to: 10000
                    stepSize: 100
                    value: profileSettings.cacheSizeMB
                    editable: true
                    onValueModified: profileSettings.cacheSizeMB = value
                }

                Label { text: "JS heap (MB):"; font.pixelSize: 12 }
                SpinBox {
                    id: heapSpin
                    from: 512
                    to: 32768
                    stepSize: 512
                    value: profileSettings.jsHeapSizeMB
                    editable: true
                    onValueModified: profileSettings.jsHeapSizeMB = value
                }

                Label { text: "Browser identity:"; font.pixelSize: 12 }
                ComboBox {
                    id: uaCombo
                    Layout.fillWidth: true
                    font.pixelSize: 12
                    model: [
                        "Auto (Chrome-like)",
                        "Chrome on Linux",
                        "Firefox on Linux",
                        "Edge on Linux",
                        "Custom..."
                    ]
                    readonly property var uaStrings: [
                        "",
                        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
                        "Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0",
                        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0",
                        "_custom_"
                    ]
                    Component.onCompleted: {
                        var saved = profileSettings.userAgent
                        if (saved.length === 0) { currentIndex = 0; return }
                        for (var i = 1; i < uaStrings.length - 1; i++) {
                            if (uaStrings[i] === saved) { currentIndex = i; return }
                        }
                        currentIndex = 4  // Custom
                    }
                    onActivated: function(index) {
                        if (index < 4) {
                            profileSettings.userAgent = uaStrings[index]
                            customUaField.visible = false
                        } else {
                            customUaField.visible = true
                            customUaField.forceActiveFocus()
                        }
                    }
                }

                Item { width: 1; height: 1; visible: customUaField.visible }
                TextField {
                    id: customUaField
                    Layout.fillWidth: true
                    font.pixelSize: 11
                    placeholderText: "Paste full UA string"
                    visible: uaCombo.currentIndex === 4
                    text: uaCombo.currentIndex === 4 ? profileSettings.userAgent : ""
                    onEditingFinished: profileSettings.userAgent = text
                }
            }

            Label {
                text: "UA/heap changes require restart."
                font.pixelSize: 11
                opacity: 0.4
            }
        }
    }

    // ── Save as app dialog ──────────────────────────────────
    Dialog {
        id: saveDialog
        title: "Save as app"
        anchors.centerIn: parent
        width: 360
        modal: true
        standardButtons: Dialog.Ok | Dialog.Cancel

        onOpened: {
            // Pre-fill with current page title
            var view = tabStack.children[tabBar.currentIndex]
            appNameField.text = view ? (view.title || "") : ""
            appNameField.selectAll()
            appNameField.forceActiveFocus()
        }

        onAccepted: {
            var view = tabStack.children[tabBar.currentIndex]
            if (view && appNameField.text.trim().length > 0) {
                helper.saveAsApp(view.url.toString(), appNameField.text.trim())
            }
        }

        ColumnLayout {
            anchors.fill: parent
            spacing: 12

            Label {
                text: "App name:"
                font.pixelSize: 13
            }

            TextField {
                id: appNameField
                Layout.fillWidth: true
                placeholderText: "e.g. QAppFramework"
                font.pixelSize: 14
                selectByMouse: true

                onAccepted: saveDialog.accept()
            }

            Label {
                text: {
                    var view = tabStack.children[tabBar.currentIndex]
                    return view ? view.url.toString() : ""
                }
                font.pixelSize: 11
                opacity: 0.6
                elide: Text.ElideRight
                Layout.fillWidth: true
            }
        }
    }

    // ── Content: WebEngine views ────────────────────────────
    Item {
        id: tabStack
        anchors.fill: parent
    }

    // ── Footer: status ──────────────────────────────────────
    footer: ToolBar {
        height: helper.statusMessage.length > 0 ? implicitHeight : 0
        visible: helper.statusMessage.length > 0

        Label {
            anchors.fill: parent
            anchors.leftMargin: 12
            text: helper.statusMessage
            font.pixelSize: 11
            opacity: 0.7
            verticalAlignment: Text.AlignVCenter
        }
    }
}
