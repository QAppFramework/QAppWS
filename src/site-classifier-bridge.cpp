#include "site-classifier-bridge.hpp"
#include "web-fetcher.hpp"
#include <QCoreApplication>
#include <QJsonDocument>
#include <QJsonObject>
#include <QDebug>

SiteClassifier::SiteClassifier(QObject *parent)
    : QObject(parent)
{
}

void SiteClassifier::classify(const QString &url)
{
    if (m_busy) return;

    clearResult();
    m_busy = true;
    m_pendingUrl = url;
    emit busyChanged();
    setStatusMessage("Classifying...");

    m_process = new QProcess(this);

    connect(m_process, &QProcess::finished, this, &SiteClassifier::onProcessFinished);

    // Find the classify.js script relative to the application directory
    QString scriptPath = QCoreApplication::applicationDirPath() + "/../bin/classify.js";

    m_process->start("node", {scriptPath, url});

    if (!m_process->waitForStarted(5000)) {
        m_errorMessage = "Failed to start Node.js process";
        m_hasResult = true;
        m_busy = false;
        emit busyChanged();
        emit resultChanged();
        setStatusMessage("Classification failed");
        m_process->deleteLater();
        m_process = nullptr;
    }
}

bool SiteClassifier::shouldTryWebEngine(const QString &error)
{
    return error.contains("403") ||
           error.contains("503") ||
           error.contains("Failed to fetch") ||
           error.contains("not reachable") ||
           error.contains("ECONNREFUSED") ||
           error.contains("UND_ERR_CONNECT_TIMEOUT");
}

void SiteClassifier::onProcessFinished(int exitCode, QProcess::ExitStatus exitStatus)
{
    if (!m_process) return;

    QByteArray output = m_process->readAllStandardOutput();
    QByteArray errOutput = m_process->readAllStandardError();

    m_process->deleteLater();
    m_process = nullptr;

    if (exitStatus != QProcess::NormalExit) {
        m_errorMessage = "Classification process crashed";
        m_hasResult = true;
        m_busy = false;
        emit busyChanged();
        emit resultChanged();
        setStatusMessage("Classification failed");
    } else if (exitCode != 0) {
        // Parse error from stdout JSON
        QString errorText;
        QJsonDocument doc = QJsonDocument::fromJson(output);
        if (doc.isObject() && doc.object().contains("error")) {
            errorText = doc.object()["error"].toString();
        } else {
            errorText = QString::fromUtf8(errOutput).trimmed();
            if (errorText.isEmpty()) {
                errorText = "Classification failed (exit code " + QString::number(exitCode) + ")";
            }
        }

        // Check if we should fallback to WebEngine
        if (shouldTryWebEngine(errorText)) {
            qDebug() << "Node.js classify failed with:" << errorText << "— trying WebEngine fallback";
            startWebEngineFallback();
        } else {
            m_errorMessage = errorText;
            m_hasResult = true;
            m_busy = false;
            emit busyChanged();
            emit resultChanged();
            setStatusMessage("Classification failed");
        }
    } else {
        m_busy = false;
        emit busyChanged();
        parseResult(output);
        setStatusMessage("Classification complete");
    }
}

void SiteClassifier::startWebEngineFallback()
{
    setStatusMessage("Retrying with browser engine...");

    m_webFetcher = new WebFetcher(this);

    connect(m_webFetcher, &WebFetcher::finished, this,
            &SiteClassifier::onWebFetchFinished);

    m_webFetcher->fetch(QUrl(m_pendingUrl));
}

void SiteClassifier::onWebFetchFinished(bool success, const QString &html,
                                         const QString &finalUrl, bool isHttps,
                                         const QString &manifestJson, bool swDetected,
                                         const QString &error)
{
    m_webFetcher = nullptr; // WebFetcher calls deleteLater() on itself

    if (!success) {
        m_errorMessage = "WebEngine fallback failed: " + error;
        m_hasResult = true;
        m_busy = false;
        emit busyChanged();
        emit resultChanged();
        setStatusMessage("Classification failed");
        return;
    }

    // Build JSON input for classify-from-data.js
    QJsonObject input;
    input["html"] = html;
    input["finalUrl"] = finalUrl;
    input["isHttps"] = isHttps;
    input["swDetected"] = swDetected;

    if (manifestJson.isEmpty()) {
        input["manifestJson"] = QJsonValue::Null;
    } else {
        QJsonDocument manifestDoc = QJsonDocument::fromJson(manifestJson.toUtf8());
        if (manifestDoc.isObject()) {
            input["manifestJson"] = manifestDoc.object();
        } else {
            input["manifestJson"] = QJsonValue::Null;
        }
    }

    QByteArray inputData = QJsonDocument(input).toJson(QJsonDocument::Compact);

    // Pipe to classify-from-data.js via stdin
    m_fallbackProcess = new QProcess(this);

    connect(m_fallbackProcess, &QProcess::finished, this,
            &SiteClassifier::onFallbackProcessFinished);

    QString scriptPath = QCoreApplication::applicationDirPath() + "/../bin/classify-from-data.js";

    m_fallbackProcess->start("node", {scriptPath});

    if (!m_fallbackProcess->waitForStarted(5000)) {
        m_errorMessage = "Failed to start fallback Node.js process";
        m_hasResult = true;
        m_busy = false;
        emit busyChanged();
        emit resultChanged();
        setStatusMessage("Classification failed");
        m_fallbackProcess->deleteLater();
        m_fallbackProcess = nullptr;
        return;
    }

    m_fallbackProcess->write(inputData);
    m_fallbackProcess->closeWriteChannel();
}

void SiteClassifier::onFallbackProcessFinished(int exitCode, QProcess::ExitStatus exitStatus)
{
    if (!m_fallbackProcess) return;

    QByteArray output = m_fallbackProcess->readAllStandardOutput();
    QByteArray errOutput = m_fallbackProcess->readAllStandardError();

    m_fallbackProcess->deleteLater();
    m_fallbackProcess = nullptr;

    m_busy = false;
    emit busyChanged();

    if (exitStatus != QProcess::NormalExit) {
        m_errorMessage = "Fallback classification process crashed";
        m_hasResult = true;
        emit resultChanged();
        setStatusMessage("Classification failed");
    } else if (exitCode != 0) {
        QJsonDocument doc = QJsonDocument::fromJson(output);
        if (doc.isObject() && doc.object().contains("error")) {
            m_errorMessage = doc.object()["error"].toString();
        } else {
            m_errorMessage = QString::fromUtf8(errOutput).trimmed();
            if (m_errorMessage.isEmpty()) {
                m_errorMessage = "Fallback classification failed (exit code " + QString::number(exitCode) + ")";
            }
        }
        m_hasResult = true;
        emit resultChanged();
        setStatusMessage("Classification failed");
    } else {
        parseResult(output);
        setStatusMessage("Classification complete");
    }
}

void SiteClassifier::clearResult()
{
    m_hasResult = false;
    m_level.clear();
    m_name.clear();
    m_iconUrl.clear();
    m_displayMode.clear();
    m_themeColor.clear();
    m_startUrl.clear();
    m_hasManifest = false;
    m_hasServiceWorker = false;
    m_errorMessage.clear();
    m_pendingUrl.clear();
    m_classifyResultJson.clear();
}

void SiteClassifier::parseResult(const QByteArray &output)
{
    QJsonDocument doc = QJsonDocument::fromJson(output);
    if (!doc.isObject()) {
        m_errorMessage = "Invalid JSON output from classifier";
        m_hasResult = true;
        emit resultChanged();
        return;
    }

    QJsonObject root = doc.object();
    QJsonObject classification = root["classification"].toObject();
    QJsonObject metadata = root["metadata"].toObject();

    m_level = classification["level"].toString();
    m_hasManifest = classification["hasManifest"].toBool();
    m_hasServiceWorker = classification["hasServiceWorker"].toBool();

    m_name = metadata["name"].toString();
    m_iconUrl = metadata["iconUrl"].toString();
    m_displayMode = metadata["displayMode"].toString();
    m_themeColor = metadata["themeColor"].toString();
    m_startUrl = metadata["startUrl"].toString();

    // Store raw JSON for passing to installer (avoids re-classification)
    m_classifyResultJson = QString::fromUtf8(output).trimmed();

    m_hasResult = true;
    emit resultChanged();
}

void SiteClassifier::setStatusMessage(const QString &msg)
{
    if (m_statusMessage != msg) {
        m_statusMessage = msg;
        emit statusMessageChanged();
    }
}
