cmake_minimum_required(VERSION 3.22)
project(qapp-installer VERSION 0.1.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_AUTOMOC ON)

find_package(Qt6 6.5 REQUIRED COMPONENTS Core Gui Quick QuickControls2 Widgets WebEngineQuick)

qt_add_executable(qapp-installer
    src/main.cpp
    src/site-classifier-bridge.hpp
    src/site-classifier-bridge.cpp
    src/app-installer-bridge.hpp
    src/app-installer-bridge.cpp
    src/web-fetcher.hpp
    src/web-fetcher.cpp
)

qt_add_qml_module(qapp-installer
    URI QAppInstaller
    VERSION 1.0
    QML_FILES
        qml/main.qml
)

target_include_directories(qapp-installer PRIVATE ${CMAKE_SOURCE_DIR}/src)

option(QAPP_DEV_BUILD "Mark as development build" OFF)
if(QAPP_DEV_BUILD)
    target_compile_definitions(qapp-installer PRIVATE QAPP_APP_NAME="QApp Dev" QAPP_APP_ID="qapp-installer-dev")
else()
    target_compile_definitions(qapp-installer PRIVATE QAPP_APP_NAME="QApp" QAPP_APP_ID="qapp-installer")
endif()

target_link_libraries(qapp-installer PRIVATE
    Qt6::Core
    Qt6::Gui
    Qt6::Quick
    Qt6::QuickControls2
    Qt6::Widgets
    Qt6::WebEngineQuick
)

# --- qapp-wrapper: standalone WebEngine launcher for installed apps ---
qt_add_executable(qapp-wrapper
    src/qapp-wrapper-main.cpp
    src/wrapper-helper.hpp
    src/wrapper-helper.cpp
)

target_include_directories(qapp-wrapper PRIVATE ${CMAKE_SOURCE_DIR}/src)

qt_add_qml_module(qapp-wrapper
    URI QAppWrapper
    VERSION 1.0
    QML_FILES
        qml/wrapper.qml
        qml/WrapperTab.qml
)

if(QAPP_DEV_BUILD)
    target_compile_definitions(qapp-wrapper PRIVATE QAPP_APP_NAME="QApp Dev" QAPP_DEV_BUILD)
else()
    target_compile_definitions(qapp-wrapper PRIVATE QAPP_APP_NAME="QApp")
endif()

target_link_libraries(qapp-wrapper PRIVATE
    Qt6::Core
    Qt6::Gui
    Qt6::Quick
    Qt6::Widgets
    Qt6::WebEngineQuick
)
