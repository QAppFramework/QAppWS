#ifndef WEB_FETCHER_HPP
#define WEB_FETCHER_HPP

#include <QObject>
#include <QString>
#include <QUrl>
#include <QTimer>

class QWebEnginePage;
class QWebEngineProfile;

/**
 * Headless WebEngine page fetcher.
 *
 * Loads a URL in a QWebEnginePage (Chromium), waits for load,
 * then extracts HTML, manifest link, manifest JSON, and SW status
 * via JavaScript injection. Emits finished() with all data.
 *
 * Usage:
 *   auto *fetcher = new WebFetcher(this);
 *   connect(fetcher, &WebFetcher::finished, this, &MyClass::onFetchDone);
 *   fetcher->fetch(url);
 */
class WebFetcher : public QObject
{
    Q_OBJECT

public:
    explicit WebFetcher(QObject *parent = nullptr);
    ~WebFetcher() override;

    void fetch(const QUrl &url);

signals:
    void finished(bool success,
                  const QString &html,
                  const QString &finalUrl,
                  bool isHttps,
                  const QString &manifestJson,
                  bool swDetected,
                  const QString &error);

private slots:
    void onLoadFinished(bool ok);
    void onTimeout();

private:
    void extractData();
    void emitError(const QString &error);

    QWebEngineProfile *m_profile = nullptr;
    QWebEnginePage *m_page = nullptr;
    QTimer m_timer;
    QUrl m_requestedUrl;
    bool m_done = false;
};

#endif // WEB_FETCHER_HPP
