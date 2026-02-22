#include "web-fetcher.hpp"
#include <QWebEnginePage>
#include <QWebEngineProfile>
#include <QJsonDocument>
#include <QJsonObject>
#include <QJsonParseError>
#include <QDebug>

WebFetcher::WebFetcher(QObject *parent)
    : QObject(parent)
{
    m_timer.setSingleShot(true);
    connect(&m_timer, &QTimer::timeout, this, &WebFetcher::onTimeout);
}

WebFetcher::~WebFetcher()
{
    m_timer.stop();
    delete m_page;
    delete m_profile;
}

void WebFetcher::fetch(const QUrl &url)
{
    if (m_page) {
        emitError("Fetch already in progress");
        return;
    }

    m_done = false;
    m_requestedUrl = url;

    // Off-the-record profile — no disk state
    m_profile = new QWebEngineProfile(this);
    m_page = new QWebEnginePage(m_profile, this);

    connect(m_page, &QWebEnginePage::loadFinished, this, &WebFetcher::onLoadFinished);

    m_timer.start(30000); // 30s timeout
    m_page->load(url);
}

void WebFetcher::onLoadFinished(bool ok)
{
    if (m_done) return;

    if (!ok) {
        emitError("Page load failed");
        return;
    }

    extractData();
}

void WebFetcher::onTimeout()
{
    if (m_done) return;
    emitError("Page load timed out (30s)");
}

void WebFetcher::extractData()
{
    if (m_done) return;

    // Synchronous JS — no async/await (Qt runJavaScript doesn't resolve promises)
    // SW: check navigator.serviceWorker.controller (sync) instead of getRegistration() (async)
    // Manifest: sync XMLHttpRequest to fetch manifest JSON
    const QString js = QStringLiteral(R"JS(
        (function() {
            var result = {};

            // 1. Full HTML
            result.html = document.documentElement.outerHTML;

            // 2. Final URL (after redirects)
            result.finalUrl = window.location.href;

            // 3. HTTPS?
            result.isHttps = window.location.protocol === 'https:';

            // 4. Manifest link
            var manifestLink = document.querySelector('link[rel="manifest"]');
            result.manifestUrl = manifestLink ? manifestLink.href : null;

            // 5. Service worker detection (sync check)
            try {
                result.swDetected = !!(navigator.serviceWorker && navigator.serviceWorker.controller);
            } catch (e) {
                result.swDetected = false;
            }

            // 6. Fetch manifest JSON via sync XHR (if manifest link found)
            result.manifestJson = null;
            if (result.manifestUrl) {
                try {
                    var xhr = new XMLHttpRequest();
                    xhr.open('GET', result.manifestUrl, false);
                    xhr.send();
                    if (xhr.status === 200) {
                        result.manifestJson = JSON.parse(xhr.responseText);
                    }
                } catch (e) {
                    // Manifest fetch failed — continue without it
                }
            }

            return JSON.stringify(result);
        })()
    )JS");

    m_page->runJavaScript(js, [this](const QVariant &result) {
        if (m_done) return;
        m_done = true;
        m_timer.stop();

        if (!result.isValid() || result.isNull()) {
            emit finished(false, {}, {}, false, {}, false, "JS extraction returned null");
            deleteLater();
            return;
        }

        const QString jsonStr = result.toString();
        QJsonParseError parseError;
        QJsonDocument doc = QJsonDocument::fromJson(jsonStr.toUtf8(), &parseError);

        if (doc.isNull()) {
            emit finished(false, {}, {}, false, {}, false,
                         "Failed to parse JS result: " + parseError.errorString());
            deleteLater();
            return;
        }

        QJsonObject obj = doc.object();
        const QString html = obj["html"].toString();
        const QString finalUrl = obj["finalUrl"].toString();
        const bool isHttps = obj["isHttps"].toBool();
        const bool swDetected = obj["swDetected"].toBool();

        // Manifest JSON as string (null or JSON object)
        QString manifestJson;
        if (obj["manifestJson"].isObject()) {
            manifestJson = QString::fromUtf8(
                QJsonDocument(obj["manifestJson"].toObject()).toJson(QJsonDocument::Compact));
        }

        emit finished(true, html, finalUrl, isHttps, manifestJson, swDetected, {});
        deleteLater();
    });
}

void WebFetcher::emitError(const QString &error)
{
    if (m_done) return;
    m_done = true;
    m_timer.stop();
    emit finished(false, {}, {}, false, {}, false, error);
    deleteLater();
}
