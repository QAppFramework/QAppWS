#include "wrapper-helper.hpp"
#include <QCoreApplication>
#include <QDir>
#include <QFile>
#include <QJsonDocument>
#include <QJsonObject>
#include <QStandardPaths>
#include <QUrl>

WrapperHelper::WrapperHelper(QObject *parent)
    : QObject(parent)
{
}

void WrapperHelper::loadMetadata(const QString &appId)
{
    if (appId.isEmpty()) return;

    QString dataDir = QStandardPaths::writableLocation(QStandardPaths::GenericDataLocation);
    QString metaPath = dataDir + "/qapp-framework/apps/" + appId + ".json";

    QFile file(metaPath);
    if (!file.open(QIODevice::ReadOnly)) {
        // No metadata file — WS or legacy install, use browser defaults
        m_metadataLoaded = true;
        emit metadataChanged();
        return;
    }

    QByteArray data = file.readAll();
    file.close();

    QJsonDocument doc = QJsonDocument::fromJson(data);
    if (!doc.isObject()) {
        m_metadataLoaded = true;
        emit metadataChanged();
        return;
    }

    QJsonObject obj = doc.object();
    m_displayMode = obj.value("displayMode").toString();
    m_themeColor = obj.value("themeColor").toString();
    m_scope = obj.value("scope").toString();

    // Resolve startUrl: if relative, resolve against the url field
    QString startUrl = obj.value("startUrl").toString();
    if (!startUrl.isEmpty()) {
        m_metadataStartUrl = startUrl;
    }

    // Resolve scope to absolute if relative
    if (!m_scope.isEmpty()) {
        QString baseUrl = obj.value("url").toString();
        if (!baseUrl.isEmpty()) {
            QUrl resolved = QUrl(baseUrl).resolved(QUrl(m_scope));
            m_scope = resolved.toString();
        }
    }

    m_metadataLoaded = true;
    emit metadataChanged();
}

void WrapperHelper::clearAppDataAndRestart(const QString &appId)
{
    if (appId.isEmpty()) return;

    // WebEngine stores profile data under <AppData>/QtWebEngine/<storageName>/
    QString dataPath = QStandardPaths::writableLocation(QStandardPaths::AppDataLocation)
                       + "/QtWebEngine/" + appId;

    // Relaunch args: same binary + same arguments
    QString exe = QCoreApplication::applicationFilePath();
    QStringList args = QCoreApplication::arguments().mid(1);

    // Spawn a detached shell that waits for us to exit, deletes data, relaunches
    QString cmd = QString("sleep 0.5 && rm -rf '%1' && exec '%2' %3")
                      .arg(dataPath, exe, args.join("' '").prepend("'").append("'"));

    QProcess::startDetached("bash", {"-c", cmd});
    QCoreApplication::quit();
}

void WrapperHelper::saveAsApp(const QString &url, const QString &name)
{
    if (m_busy) return;

    m_busy = true;
    m_statusMessage = "Installing...";
    emit busyChanged();
    emit statusChanged();

    m_process = new QProcess(this);
    connect(m_process, &QProcess::finished, this, &WrapperHelper::onFinished);

    QString scriptPath = QCoreApplication::applicationDirPath() + "/../bin/install.js";
    QString wrapperPath = QCoreApplication::applicationDirPath() + "/qapp-wrapper";

    QStringList processArgs = {scriptPath, url, "--wrapper-path", wrapperPath};
    if (!name.isEmpty()) {
        processArgs << "--name" << name;
    }

    m_process->start("node", processArgs);

    if (!m_process->waitForStarted(5000)) {
        m_statusMessage = "Failed to start install process";
        m_busy = false;
        emit busyChanged();
        emit statusChanged();
        m_process->deleteLater();
        m_process = nullptr;
    }
}

void WrapperHelper::onFinished(int exitCode, QProcess::ExitStatus exitStatus)
{
    m_busy = false;
    emit busyChanged();

    if (!m_process) return;

    QByteArray output = m_process->readAllStandardOutput();

    if (exitStatus == QProcess::NormalExit && exitCode == 0) {
        QJsonDocument doc = QJsonDocument::fromJson(output);
        if (doc.isObject()) {
            QString name = doc.object()["name"].toString();
            m_statusMessage = "Saved as app: " + name;
        } else {
            m_statusMessage = "Saved as app";
        }
    } else {
        QJsonDocument doc = QJsonDocument::fromJson(output);
        if (doc.isObject() && doc.object().contains("error")) {
            m_statusMessage = doc.object()["error"].toString();
        } else {
            m_statusMessage = "Install failed";
        }
    }

    emit statusChanged();
    m_process->deleteLater();
    m_process = nullptr;
}
