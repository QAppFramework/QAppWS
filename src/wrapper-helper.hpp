#ifndef WRAPPER_HELPER_HPP
#define WRAPPER_HELPER_HPP

#include <QObject>
#include <QProcess>
#include <QString>
#include <QtQml/qqmlregistration.h>

class WrapperHelper : public QObject
{
    Q_OBJECT
    QML_ELEMENT

    Q_PROPERTY(bool busy READ busy NOTIFY busyChanged)
    Q_PROPERTY(QString statusMessage READ statusMessage NOTIFY statusChanged)

    Q_PROPERTY(bool metadataLoaded READ metadataLoaded NOTIFY metadataChanged)
    Q_PROPERTY(QString displayMode READ displayMode NOTIFY metadataChanged)
    Q_PROPERTY(QString themeColor READ themeColor NOTIFY metadataChanged)
    Q_PROPERTY(QString metadataStartUrl READ metadataStartUrl NOTIFY metadataChanged)
    Q_PROPERTY(QString scope READ scope NOTIFY metadataChanged)

public:
    explicit WrapperHelper(QObject *parent = nullptr);

    bool busy() const { return m_busy; }
    QString statusMessage() const { return m_statusMessage; }

    bool metadataLoaded() const { return m_metadataLoaded; }
    QString displayMode() const { return m_displayMode; }
    QString themeColor() const { return m_themeColor; }
    QString metadataStartUrl() const { return m_metadataStartUrl; }
    QString scope() const { return m_scope; }

    Q_INVOKABLE void saveAsApp(const QString &url, const QString &name);
    Q_INVOKABLE void loadMetadata(const QString &appId);
    Q_INVOKABLE void clearAppDataAndRestart(const QString &appId);

signals:
    void busyChanged();
    void statusChanged();
    void metadataChanged();

private slots:
    void onFinished(int exitCode, QProcess::ExitStatus exitStatus);

private:
    QProcess *m_process = nullptr;
    bool m_busy = false;
    QString m_statusMessage;

    bool m_metadataLoaded = false;
    QString m_displayMode;
    QString m_themeColor;
    QString m_metadataStartUrl;
    QString m_scope;
};

#endif // WRAPPER_HELPER_HPP
