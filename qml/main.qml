import QtQuick
import QtQuick.Controls
import QtQuick.Layouts
import QAppInstaller

ApplicationWindow {
    id: root
    width: 640
    height: 480
    minimumWidth: 400
    minimumHeight: 300
    visible: true
    title: Qt.application.name === "qapp-installer-dev" ? "QApp Dev" : "QApp"

    // URL validation — matches http(s)://domain.tld with optional path
    // Canonical logic: src/url-validator.js (keep in sync)
    readonly property var _urlPattern: /^https?:\/\/[a-zA-Z0-9]([a-zA-Z0-9\-]*[a-zA-Z0-9])?(\.[a-zA-Z]{2,})+([\/\w\-._~:?#[\]@!$&'()*+,;=%]*)?$/

    function isValidUrl(text) {
        if (text.length === 0) return false;
        return _urlPattern.test(text);
    }

    // Auto-prepend https:// to bare domains
    function normalizeUrl(text) {
        if (/^https?:\/\//.test(text)) return text;
        return "https://" + text;
    }

    // Check if input looks like a domain (with or without protocol)
    function isValidInput(text) {
        if (text.length === 0) return false;
        return _urlPattern.test(normalizeUrl(text));
    }

    // Check if an app has an update available
    function hasAppUpdate(appId) {
        for (var i = 0; i < appInstaller.appUpdates.length; i++) {
            var entry = appInstaller.appUpdates[i]
            if (entry.appId === appId && entry.hasUpdate)
                return true
        }
        return false
    }

    SiteClassifier {
        id: classifier
    }

    AppInstaller {
        id: appInstaller
    }

    // ── Hamburger menu (F10) ────────────────────────────────
    Shortcut {
        sequence: "F10"
        onActivated: mainMenu.popup()
    }

    Menu {
        id: mainMenu

        Action {
            text: "Update QApp"
            enabled: !appInstaller.busy
            onTriggered: updateDialog.open()
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

    // ── Update dialog ───────────────────────────────────────
    Dialog {
        id: updateDialog
        title: "Update QApp"
        anchors.centerIn: parent
        width: 400
        modal: true
        standardButtons: appInstaller.busy ? Dialog.NoButton : Dialog.Close

        ColumnLayout {
            anchors.fill: parent
            spacing: 16

            Label {
                text: appInstaller.busy
                    ? "Updating QApp..."
                    : (appInstaller.updateStatus.length > 0
                        ? appInstaller.updateStatus
                        : "Check for updates from GitHub and install the latest version.\nAll wrapper apps will be updated.")
                font.pixelSize: 13
                wrapMode: Text.WordWrap
                Layout.fillWidth: true
            }

            BusyIndicator {
                Layout.alignment: Qt.AlignHCenter
                running: appInstaller.busy
                visible: appInstaller.busy
            }

            Label {
                visible: appInstaller.busy && appInstaller.updateStatus.length > 0
                text: appInstaller.updateStatus
                font.pixelSize: 11
                opacity: 0.6
                wrapMode: Text.WordWrap
                Layout.fillWidth: true
            }

            Button {
                text: "Update now"
                Layout.alignment: Qt.AlignHCenter
                visible: !appInstaller.busy && !appInstaller.updateStatus.startsWith("Updated!")
                onClicked: appInstaller.updateQApp()
            }
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

    header: ToolBar {
        ColumnLayout {
            anchors.fill: parent
            spacing: 0

            RowLayout {
                Layout.fillWidth: true
                Layout.leftMargin: 12

                Label {
                    text: root.title
                    font.pixelSize: 18
                    font.bold: true
                }

                Item { Layout.fillWidth: true }

                ToolButton {
                    text: "\u2630"
                    font.pixelSize: 16
                    onClicked: mainMenu.popup()
                }
            }

            TabBar {
                id: tabBar
                Layout.fillWidth: true

                TabButton {
                    text: "Install"
                }
                TabButton {
                    text: "Manage"
                    onClicked: {
                        appInstaller.listApps()
                        appInstaller.checkUpdates()
                    }
                }
            }
        }
    }

    StackLayout {
        anchors.fill: parent
        currentIndex: tabBar.currentIndex

        // ── Install tab ──────────────────────────────────────────
        ColumnLayout {
            Layout.margins: 20
            spacing: 16

            Item { Layout.fillHeight: true }

            Label {
                text: "Enter a URL to install as app"
                font.pixelSize: 14
                Layout.alignment: Qt.AlignHCenter
                opacity: 0.7
            }

        RowLayout {
            Layout.fillWidth: true
            Layout.maximumWidth: 500
            Layout.alignment: Qt.AlignHCenter
            spacing: 8

            TextField {
                id: urlField
                Layout.fillWidth: true
                placeholderText: "example.com"
                selectByMouse: true
                font.pixelSize: 14
                enabled: !classifier.busy

                property bool hasInput: text.length > 0
                property bool valid: root.isValidInput(text)

                background: Rectangle {
                    implicitHeight: 40
                    radius: 4
                    border.width: urlField.activeFocus || urlField.hasInput ? 2 : 1
                    border.color: {
                        if (!urlField.hasInput) return palette.mid;
                        if (urlField.valid) return "#4caf50";
                        return "#f44336";
                    }
                    color: palette.base
                }

                onAccepted: {
                    if (valid) classifyButton.clicked();
                }
            }

            Button {
                id: classifyButton
                text: classifier.busy ? "Classifying..." : "Classify"
                enabled: urlField.valid && !classifier.busy
                font.pixelSize: 14

                onClicked: {
                    var url = root.normalizeUrl(urlField.text);
                    classifier.classify(url);
                }
            }
        }

        Label {
            id: validationHint
            Layout.alignment: Qt.AlignHCenter
            font.pixelSize: 12
            opacity: 0.6
            text: {
                if (!urlField.hasInput) return " ";
                if (urlField.valid) return "Valid URL";
                return "Enter a valid URL starting with http:// or https://";
            }
            color: {
                if (!urlField.hasInput) return palette.text;
                if (urlField.valid) return "#4caf50";
                return "#f44336";
            }
        }

        // Classification results panel
        Rectangle {
            id: resultsPanel
            Layout.fillWidth: true
            Layout.maximumWidth: 500
            Layout.alignment: Qt.AlignHCenter
            Layout.preferredHeight: resultsColumn.implicitHeight + 32
            radius: 8
            color: palette.alternateBase
            border.width: 1
            border.color: palette.mid
            visible: classifier.hasResult

            ColumnLayout {
                id: resultsColumn
                anchors.fill: parent
                anchors.margins: 16
                spacing: 12

                // Error display
                Label {
                    visible: classifier.errorMessage.length > 0
                    text: classifier.errorMessage
                    color: "#f44336"
                    font.pixelSize: 13
                    wrapMode: Text.WordWrap
                    Layout.fillWidth: true
                }

                // Level badge + name row
                RowLayout {
                    visible: classifier.errorMessage.length === 0
                    spacing: 12

                    Rectangle {
                        id: levelBadge
                        width: 64
                        height: 28
                        radius: 4
                        color: {
                            if (classifier.level === "PWAPP") return "#4caf50";
                            if (classifier.level === "WAPP") return "#2196f3";
                            return "#9e9e9e";
                        }

                        Label {
                            anchors.centerIn: parent
                            text: classifier.level
                            font.pixelSize: 13
                            font.bold: true
                            color: "white"
                        }
                    }

                    Label {
                        text: classifier.name
                        font.pixelSize: 16
                        font.bold: true
                        elide: Text.ElideRight
                        Layout.fillWidth: true
                    }
                }

                // Metadata grid
                GridLayout {
                    visible: classifier.errorMessage.length === 0
                    columns: 2
                    columnSpacing: 12
                    rowSpacing: 6
                    Layout.fillWidth: true

                    Label { text: "Display mode:"; opacity: 0.6; font.pixelSize: 12 }
                    Label { text: classifier.displayMode; font.pixelSize: 12 }

                    Label { text: "Theme color:"; opacity: 0.6; font.pixelSize: 12; visible: classifier.themeColor.length > 0 }
                    RowLayout {
                        visible: classifier.themeColor.length > 0
                        spacing: 6
                        Rectangle {
                            width: 14; height: 14; radius: 2
                            color: classifier.themeColor.length > 0 ? classifier.themeColor : "transparent"
                            border.width: 1; border.color: palette.mid
                        }
                        Label { text: classifier.themeColor; font.pixelSize: 12 }
                    }

                    Label { text: "Start URL:"; opacity: 0.6; font.pixelSize: 12; visible: classifier.startUrl.length > 0 }
                    Label { text: classifier.startUrl; font.pixelSize: 12; visible: classifier.startUrl.length > 0; elide: Text.ElideRight; Layout.fillWidth: true }

                    Label { text: "Manifest:"; opacity: 0.6; font.pixelSize: 12 }
                    Label { text: classifier.hasManifest ? "Yes" : "No"; font.pixelSize: 12; color: classifier.hasManifest ? "#4caf50" : "#9e9e9e" }

                    Label { text: "Service worker:"; opacity: 0.6; font.pixelSize: 12 }
                    Label { text: classifier.hasServiceWorker ? "Yes" : "No"; font.pixelSize: 12; color: classifier.hasServiceWorker ? "#4caf50" : "#9e9e9e" }
                }
            }
        }

        // Install/Remove actions
        RowLayout {
            Layout.alignment: Qt.AlignHCenter
            Layout.maximumWidth: 500
            spacing: 12
            visible: classifier.hasResult && classifier.errorMessage.length === 0 && !appInstaller.busy

            Button {
                text: appInstaller.installed ? "Reinstall" : "Install"
                enabled: !appInstaller.busy
                font.pixelSize: 14

                onClicked: {
                    if (classifier.classifyResultJson.length > 0) {
                        appInstaller.installFromData(classifier.classifyResultJson);
                    } else {
                        var url = root.normalizeUrl(urlField.text);
                        appInstaller.install(url);
                    }
                }
            }

            Button {
                text: "Remove"
                visible: appInstaller.installed
                enabled: !appInstaller.busy
                font.pixelSize: 14

                onClicked: {
                    appInstaller.uninstall(appInstaller.appId);
                }
            }
        }

        // Install status feedback
        ColumnLayout {
            Layout.alignment: Qt.AlignHCenter
            Layout.maximumWidth: 500
            spacing: 4
            visible: appInstaller.installed || appInstaller.errorMessage.length > 0

            Label {
                visible: appInstaller.installed
                text: "Installed! \"" + appInstaller.appName + "\" is available in your system launcher."
                font.pixelSize: 13
                color: "#4caf50"
                wrapMode: Text.WordWrap
                Layout.fillWidth: true
                Layout.alignment: Qt.AlignHCenter
            }

            Label {
                visible: appInstaller.errorMessage.length > 0
                text: appInstaller.errorMessage
                font.pixelSize: 13
                color: "#f44336"
                wrapMode: Text.WordWrap
                Layout.fillWidth: true
                Layout.alignment: Qt.AlignHCenter
            }
        }

        // Loading indicator
        BusyIndicator {
            Layout.alignment: Qt.AlignHCenter
            running: classifier.busy || appInstaller.busy
            visible: classifier.busy || appInstaller.busy
        }

        Label {
            Layout.alignment: Qt.AlignHCenter
            text: "Installing..."
            font.pixelSize: 13
            opacity: 0.6
            visible: appInstaller.busy
        }

            Item { Layout.fillHeight: true }
        }

        // ── Manage tab ───────────────────────────────────────────
        ColumnLayout {
            Layout.margins: 20
            spacing: 16

            Label {
                text: appInstaller.installedApps.length === 0 && !appInstaller.busy
                    ? "No apps installed"
                    : appInstaller.installedApps.length + " installed app" + (appInstaller.installedApps.length !== 1 ? "s" : "")
                font.pixelSize: 14
                Layout.alignment: Qt.AlignHCenter
                opacity: 0.7
            }

            ListView {
                id: appListView
                Layout.fillWidth: true
                Layout.fillHeight: true
                Layout.maximumWidth: 500
                Layout.alignment: Qt.AlignHCenter
                clip: true
                spacing: 8
                model: appInstaller.installedApps

                delegate: Rectangle {
                    required property var modelData
                    required property int index
                    width: appListView.width
                    height: delegateRow.implicitHeight + 24
                    radius: 8
                    color: palette.alternateBase
                    border.width: 1
                    border.color: palette.mid

                    RowLayout {
                        id: delegateRow
                        anchors.fill: parent
                        anchors.margins: 12
                        spacing: 12

                        // Level badge
                        Rectangle {
                            width: 48
                            height: 24
                            radius: 4
                            color: {
                                var level = modelData.level || "";
                                if (level === "PWAPP") return "#4caf50";
                                if (level === "WAPP") return "#2196f3";
                                return "#9e9e9e";
                            }

                            Label {
                                anchors.centerIn: parent
                                text: modelData.level || "WS"
                                font.pixelSize: 11
                                font.bold: true
                                color: "white"
                            }
                        }

                        // App info
                        ColumnLayout {
                            Layout.fillWidth: true
                            spacing: 2

                            RowLayout {
                                spacing: 8

                                Label {
                                    text: modelData.name || modelData.appId
                                    font.pixelSize: 14
                                    font.bold: true
                                    elide: Text.ElideRight
                                    Layout.fillWidth: true
                                }

                                Rectangle {
                                    width: updateLabel.implicitWidth + 12
                                    height: 18
                                    radius: 9
                                    color: "#ff9800"
                                    visible: root.hasAppUpdate(modelData.appId)

                                    Label {
                                        id: updateLabel
                                        anchors.centerIn: parent
                                        text: "Update"
                                        font.pixelSize: 10
                                        font.bold: true
                                        color: "white"
                                    }
                                }
                            }

                            Label {
                                text: modelData.url || ""
                                font.pixelSize: 11
                                opacity: 0.6
                                elide: Text.ElideRight
                                Layout.fillWidth: true
                            }
                        }

                        // Update button (only when update available)
                        Button {
                            text: "Update"
                            font.pixelSize: 12
                            visible: root.hasAppUpdate(modelData.appId)
                            enabled: !appInstaller.busy

                            onClicked: {
                                appInstaller.install(modelData.url)
                            }
                        }

                        // Launch button
                        Button {
                            text: "Open"
                            font.pixelSize: 12

                            onClicked: {
                                appInstaller.launch(modelData.appId, modelData.url)
                            }
                        }

                        // Remove button
                        Button {
                            text: "Remove"
                            font.pixelSize: 12
                            enabled: !appInstaller.busy

                            onClicked: {
                                appInstaller.uninstall(modelData.appId);
                            }
                        }
                    }
                }
            }

            BusyIndicator {
                Layout.alignment: Qt.AlignHCenter
                running: appInstaller.busy
                visible: appInstaller.busy
            }

            Label {
                text: "Checking for updates..."
                font.pixelSize: 11
                opacity: 0.5
                Layout.alignment: Qt.AlignHCenter
                visible: appInstaller.checkingUpdates
            }
        }
    }

    footer: ToolBar {
        RowLayout {
            anchors.fill: parent
            anchors.leftMargin: 12

            Label {
                id: statusText
                text: {
                    if (appInstaller.busy) return "Installing...";
                    if (classifier.busy && classifier.statusMessage.length > 0)
                        return classifier.statusMessage;
                    if (classifier.busy) return "Classifying...";
                    if (appInstaller.installed) return "Installed: " + appInstaller.appName;
                    if (classifier.hasResult && classifier.errorMessage.length === 0)
                        return "Classification complete";
                    if (classifier.hasResult && classifier.errorMessage.length > 0)
                        return "Classification failed";
                    return "Ready";
                }
                font.pixelSize: 12
                opacity: 0.6
            }

            Item { Layout.fillWidth: true }
        }
    }
}
