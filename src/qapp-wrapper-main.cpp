#include <QApplication>
#include <QQmlApplicationEngine>
#include <QSettings>
#include <QtWebEngineQuick>
#include <cstdio>

int main(int argc, char *argv[])
{
#ifdef QAPP_DEV_BUILD
    qputenv("QML_DISABLE_DISK_CACHE", "1");
    qputenv("QTWEBENGINE_REMOTE_DEBUGGING", "9222");
#endif

    // Read profile settings before WebEngine init (V8 flags must be set early)
    QSettings settings("TwistedBrain", "QApp Wrapper");
    int heapMB = settings.value("profile/jsHeapSizeMB", 4096).toInt();
    if (heapMB > 0) {
        QByteArray flags = qgetenv("QTWEBENGINE_CHROMIUM_FLAGS");
        if (!flags.isEmpty()) flags += ' ';
        flags += "--js-flags=--max-old-space-size=" + QByteArray::number(heapMB);
        qputenv("QTWEBENGINE_CHROMIUM_FLAGS", flags);
    }

    QtWebEngineQuick::initialize();

    QApplication app(argc, argv);
    app.setApplicationName("QApp Wrapper");
    app.setOrganizationName("TwistedBrain");

    QQmlApplicationEngine engine;

    const QUrl qmlUrl(QStringLiteral("qrc:/QAppWrapper/qml/wrapper.qml"));

    QObject::connect(&engine, &QQmlApplicationEngine::objectCreationFailed,
        &app, [](const QUrl &url) {
            fprintf(stderr, "QML object creation failed: %s\n", url.toString().toUtf8().constData());
            QCoreApplication::exit(-1);
        },
        Qt::QueuedConnection);

    engine.load(qmlUrl);

    if (engine.rootObjects().isEmpty()) {
        fprintf(stderr, "QML failed to load\n");
        return -1;
    }

    return app.exec();
}
