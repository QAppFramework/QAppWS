#ifndef APP_INSTALLER_BRIDGE_HPP
#define APP_INSTALLER_BRIDGE_HPP

#include <QObject>
#include <QProcess>
#include <QString>
#include <QJsonArray>
#include <QtQml/qqmlregistration.h>

class AppInstaller : public QObject
{
    Q_OBJECT
    QML_ELEMENT

    Q_PROPERTY(bool busy READ busy NOTIFY busyChanged)
    Q_PROPERTY(bool installed READ installed NOTIFY resultChanged)
    Q_PROPERTY(QString appId READ appId NOTIFY resultChanged)
    Q_PROPERTY(QString appName READ appName NOTIFY resultChanged)
    Q_PROPERTY(QString desktopPath READ desktopPath NOTIFY resultChanged)
    Q_PROPERTY(QString errorMessage READ errorMessage NOTIFY resultChanged)
    Q_PROPERTY(QJsonArray installedApps READ installedApps NOTIFY installedAppsChanged)
    Q_PROPERTY(QString updateStatus READ updateStatus NOTIFY updateStatusChanged)
    Q_PROPERTY(QJsonArray appUpdates READ appUpdates NOTIFY appUpdatesChanged)
    Q_PROPERTY(bool checkingUpdates READ checkingUpdates NOTIFY checkingUpdatesChanged)

public:
    explicit AppInstaller(QObject *parent = nullptr);

    bool busy() const { return m_busy; }
    bool installed() const { return m_installed; }
    QString appId() const { return m_appId; }
    QString appName() const { return m_appName; }
    QString desktopPath() const { return m_desktopPath; }
    QString errorMessage() const { return m_errorMessage; }
    QJsonArray installedApps() const { return m_installedApps; }
    QString updateStatus() const { return m_updateStatus; }
    QJsonArray appUpdates() const { return m_appUpdates; }
    bool checkingUpdates() const { return m_checkingUpdates; }

    Q_INVOKABLE void install(const QString &url);
    Q_INVOKABLE void installFromData(const QString &classifyResultJson);
    Q_INVOKABLE void uninstall(const QString &appId);
    Q_INVOKABLE void listApps();
    Q_INVOKABLE void launch(const QString &appId, const QString &url);
    Q_INVOKABLE void updateQApp();
    Q_INVOKABLE void checkUpdates();

signals:
    void busyChanged();
    void resultChanged();
    void installedAppsChanged();
    void updateStatusChanged();
    void appUpdatesChanged();
    void checkingUpdatesChanged();

private slots:
    void onInstallFinished(int exitCode, QProcess::ExitStatus exitStatus);
    void onUninstallFinished(int exitCode, QProcess::ExitStatus exitStatus);
    void onListFinished(int exitCode, QProcess::ExitStatus exitStatus);
    void onUpdateFinished(int exitCode, QProcess::ExitStatus exitStatus);
    void onCheckUpdatesFinished(int exitCode, QProcess::ExitStatus exitStatus);

private:
    void clearResult();

    QProcess *m_process = nullptr;
    bool m_busy = false;
    bool m_installed = false;
    QString m_appId;
    QString m_appName;
    QString m_desktopPath;
    QString m_errorMessage;
    QJsonArray m_installedApps;
    QString m_updateStatus;
    QJsonArray m_appUpdates;
    bool m_checkingUpdates = false;
    QProcess *m_checkProcess = nullptr;
};

#endif // APP_INSTALLER_BRIDGE_HPP
