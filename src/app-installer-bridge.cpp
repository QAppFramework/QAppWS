#include "app-installer-bridge.hpp"
#include <QCoreApplication>
#include <QJsonDocument>
#include <QJsonObject>
#include <QJsonArray>
#include <QDebug>

AppInstaller::AppInstaller(QObject *parent)
    : QObject(parent)
{
}

void AppInstaller::install(const QString &url)
{
    if (m_busy) return;

    clearResult();
    m_busy = true;
    emit busyChanged();

    m_process = new QProcess(this);

    connect(m_process, &QProcess::finished, this, &AppInstaller::onInstallFinished);

    QString scriptPath = QCoreApplication::applicationDirPath() + "/../bin/install.js";
    QString wrapperPath = QCoreApplication::applicationDirPath() + "/qapp-wrapper";

    m_process->start("node", {scriptPath, url, "--wrapper-path", wrapperPath});

    if (!m_process->waitForStarted(5000)) {
        m_errorMessage = "Failed to start Node.js process";
        m_busy = false;
        emit busyChanged();
        emit resultChanged();
        m_process->deleteLater();
        m_process = nullptr;
    }
}

void AppInstaller::installFromData(const QString &classifyResultJson)
{
    if (m_busy) return;

    clearResult();
    m_busy = true;
    emit busyChanged();

    m_process = new QProcess(this);

    connect(m_process, &QProcess::finished, this, &AppInstaller::onInstallFinished);

    QString scriptPath = QCoreApplication::applicationDirPath() + "/../bin/install-from-data.js";
    QString wrapperPath = QCoreApplication::applicationDirPath() + "/qapp-wrapper";

    m_process->start("node", {scriptPath, "--wrapper-path", wrapperPath});

    if (!m_process->waitForStarted(5000)) {
        m_errorMessage = "Failed to start Node.js process";
        m_busy = false;
        emit busyChanged();
        emit resultChanged();
        m_process->deleteLater();
        m_process = nullptr;
        return;
    }

    m_process->write(classifyResultJson.toUtf8());
    m_process->closeWriteChannel();
}

void AppInstaller::uninstall(const QString &appId)
{
    if (m_busy) return;

    clearResult();
    m_busy = true;
    emit busyChanged();

    m_process = new QProcess(this);

    connect(m_process, &QProcess::finished, this, &AppInstaller::onUninstallFinished);

    QString scriptPath = QCoreApplication::applicationDirPath() + "/../bin/uninstall.js";

    m_process->start("node", {scriptPath, appId});

    if (!m_process->waitForStarted(5000)) {
        m_errorMessage = "Failed to start Node.js process";
        m_busy = false;
        emit busyChanged();
        emit resultChanged();
        m_process->deleteLater();
        m_process = nullptr;
    }
}

void AppInstaller::launch(const QString &appId, const QString &url)
{
    QString wrapperPath = QCoreApplication::applicationDirPath() + "/qapp-wrapper";
    QProcess::startDetached(wrapperPath, {appId, url});
}

void AppInstaller::updateQApp()
{
    if (m_busy) return;

    m_busy = true;
    m_updateStatus = "Downloading latest version...";
    emit busyChanged();
    emit updateStatusChanged();

    m_process = new QProcess(this);

    connect(m_process, &QProcess::finished, this, &AppInstaller::onUpdateFinished);

    // Stream output for live status updates
    connect(m_process, &QProcess::readyReadStandardOutput, this, [this]() {
        QByteArray data = m_process->readAllStandardOutput();
        QString lines = QString::fromUtf8(data).trimmed();
        if (!lines.isEmpty()) {
            // Take last [QApp] line as status
            QStringList allLines = lines.split('\n');
            for (int i = allLines.size() - 1; i >= 0; --i) {
                QString line = allLines[i].trimmed();
                if (line.startsWith("[QApp]")) {
                    m_updateStatus = line.mid(7).trimmed();
                    emit updateStatusChanged();
                    break;
                }
            }
        }
    });

    QString scriptPath = QCoreApplication::applicationDirPath() + "/../bin/update.sh";

    m_process->start("bash", {scriptPath});

    if (!m_process->waitForStarted(5000)) {
        m_updateStatus = "Failed to start update process";
        m_busy = false;
        emit busyChanged();
        emit updateStatusChanged();
        m_process->deleteLater();
        m_process = nullptr;
    }
}

void AppInstaller::onUpdateFinished(int exitCode, QProcess::ExitStatus exitStatus)
{
    m_busy = false;
    emit busyChanged();

    if (!m_process) return;

    if (exitStatus == QProcess::NormalExit && exitCode == 0) {
        m_updateStatus = "Updated! Restart QApp to use the new version.";
    } else {
        QByteArray errOutput = m_process->readAllStandardError();
        QString errMsg = QString::fromUtf8(errOutput).trimmed();
        if (errMsg.isEmpty()) {
            m_updateStatus = "Update failed (exit code " + QString::number(exitCode) + ")";
        } else {
            // Find last error line
            QStringList lines = errMsg.split('\n');
            m_updateStatus = "Update failed: " + lines.last().trimmed();
        }
    }

    emit updateStatusChanged();
    m_process->deleteLater();
    m_process = nullptr;
}

void AppInstaller::listApps()
{
    if (m_busy) return;

    m_busy = true;
    emit busyChanged();

    m_process = new QProcess(this);

    connect(m_process, &QProcess::finished, this, &AppInstaller::onListFinished);

    QString scriptPath = QCoreApplication::applicationDirPath() + "/../bin/list.js";

    m_process->start("node", {scriptPath});

    if (!m_process->waitForStarted(5000)) {
        m_errorMessage = "Failed to start Node.js process";
        m_busy = false;
        emit busyChanged();
        emit resultChanged();
        m_process->deleteLater();
        m_process = nullptr;
    }
}

void AppInstaller::onListFinished(int exitCode, QProcess::ExitStatus exitStatus)
{
    m_busy = false;
    emit busyChanged();

    if (!m_process) return;

    QByteArray output = m_process->readAllStandardOutput();

    if (exitStatus == QProcess::NormalExit && exitCode == 0) {
        QJsonDocument doc = QJsonDocument::fromJson(output);
        if (doc.isArray()) {
            m_installedApps = doc.array();
        } else {
            m_installedApps = QJsonArray();
        }
    } else {
        m_installedApps = QJsonArray();
    }

    emit installedAppsChanged();
    m_process->deleteLater();
    m_process = nullptr;
}

void AppInstaller::onInstallFinished(int exitCode, QProcess::ExitStatus exitStatus)
{
    m_busy = false;
    emit busyChanged();

    if (!m_process) return;

    QByteArray output = m_process->readAllStandardOutput();
    QByteArray errOutput = m_process->readAllStandardError();

    if (exitStatus != QProcess::NormalExit) {
        m_errorMessage = "Install process crashed";
        emit resultChanged();
    } else if (exitCode != 0) {
        QJsonDocument doc = QJsonDocument::fromJson(output);
        if (doc.isObject() && doc.object().contains("error")) {
            m_errorMessage = doc.object()["error"].toString();
        } else {
            m_errorMessage = QString::fromUtf8(errOutput).trimmed();
            if (m_errorMessage.isEmpty()) {
                m_errorMessage = "Install failed (exit code " + QString::number(exitCode) + ")";
            }
        }
        emit resultChanged();
    } else {
        QJsonDocument doc = QJsonDocument::fromJson(output);
        if (doc.isObject()) {
            QJsonObject obj = doc.object();
            m_appId = obj["appId"].toString();
            m_appName = obj["name"].toString();
            m_desktopPath = obj["desktopPath"].toString();
            m_installed = true;
        } else {
            m_errorMessage = "Invalid JSON output from installer";
        }
        emit resultChanged();
    }

    m_process->deleteLater();
    m_process = nullptr;
}

void AppInstaller::onUninstallFinished(int exitCode, QProcess::ExitStatus exitStatus)
{
    m_busy = false;
    emit busyChanged();

    if (!m_process) return;

    QByteArray output = m_process->readAllStandardOutput();
    QByteArray errOutput = m_process->readAllStandardError();

    if (exitStatus != QProcess::NormalExit) {
        m_errorMessage = "Uninstall process crashed";
    } else if (exitCode != 0) {
        QJsonDocument doc = QJsonDocument::fromJson(output);
        if (doc.isObject() && doc.object().contains("error")) {
            m_errorMessage = doc.object()["error"].toString();
        } else {
            m_errorMessage = QString::fromUtf8(errOutput).trimmed();
            if (m_errorMessage.isEmpty()) {
                m_errorMessage = "Uninstall failed (exit code " + QString::number(exitCode) + ")";
            }
        }
    } else {
        m_installed = false;
        m_appId.clear();
        m_appName.clear();
        m_desktopPath.clear();
    }

    emit resultChanged();
    m_process->deleteLater();
    m_process = nullptr;

    // Auto-refresh the installed apps list after uninstall
    if (exitCode == 0 && exitStatus == QProcess::NormalExit) {
        listApps();
    }
}

void AppInstaller::checkUpdates()
{
    if (m_checkingUpdates) return;

    m_checkingUpdates = true;
    emit checkingUpdatesChanged();

    m_checkProcess = new QProcess(this);

    connect(m_checkProcess, &QProcess::finished, this, &AppInstaller::onCheckUpdatesFinished);

    QString scriptPath = QCoreApplication::applicationDirPath() + "/../bin/check-updates.js";

    m_checkProcess->start("node", {scriptPath});

    if (!m_checkProcess->waitForStarted(5000)) {
        m_checkingUpdates = false;
        emit checkingUpdatesChanged();
        m_checkProcess->deleteLater();
        m_checkProcess = nullptr;
    }
}

void AppInstaller::onCheckUpdatesFinished(int exitCode, QProcess::ExitStatus exitStatus)
{
    m_checkingUpdates = false;
    emit checkingUpdatesChanged();

    if (!m_checkProcess) return;

    QByteArray output = m_checkProcess->readAllStandardOutput();

    if (exitStatus == QProcess::NormalExit && exitCode == 0) {
        QJsonDocument doc = QJsonDocument::fromJson(output);
        if (doc.isArray()) {
            m_appUpdates = doc.array();
        } else {
            m_appUpdates = QJsonArray();
        }
    } else {
        m_appUpdates = QJsonArray();
    }

    emit appUpdatesChanged();
    m_checkProcess->deleteLater();
    m_checkProcess = nullptr;
}

void AppInstaller::clearResult()
{
    m_installed = false;
    m_appId.clear();
    m_appName.clear();
    m_desktopPath.clear();
    m_errorMessage.clear();
}
