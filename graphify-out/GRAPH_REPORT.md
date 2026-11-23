# Graph Report - AndroProject_Dev  (2026-11-22)

## Corpus Check
- 368 files · ~570,725 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2279 nodes · 4436 edges · 186 communities (165 shown, 21 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 184 edges (avg confidence: 0.78)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `2ea76590`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- types.ts
- safeExec
- devDependencies
- config.ts
- CommandResult
- DashboardAppsPanel.tsx
- webrtc.py
- tools
- validation.ts
- compilerOptions
- andro.ps1
- main.js
- route.ts
- route.ts
- FeatureErrorBoundary
- page.tsx
- IDeviceService
- layout.tsx
- route.ts
- eslint.config.mjs
- next.config.ts
- next-env.d.ts
- postcss.config.mjs
- tailwind.config.ts
- auto-install-kali-complete.sh
- check-mobile.sh
- create-shortcuts.sh
- AppShell.tsx
- INSTALL-OPPO-DIRECTO.sh
- setup-vnc-password.sh
- start-desktop.sh
- start-kali-vnc.sh
- transfer-to-phone.sh
- NavSection
- create_shortcut.ps1
- hashcat.ps1
- payload.ps1
- phone_status.ps1
- scan.ps1
- start.ps1
- stop.ps1
- 📱 Instrucciones para Descargar e Instalar en Oppo
- route.ts
- samsung-watchdog.ps1
- detect.ts
- debloat-driver.ps1
- AndroidProject 📱⚡
- index.ts
- AndroProject - Instalador Oficial
- samsung-adb.ps1
- AGENTS.md
- route.ts
- paths.rs
- Button.tsx
- page.tsx
- 🔧 Solución de Problemas
- Header.tsx
- useAdbConnection.ts
- 📱 Crear Accesos Directos en Android
- stream-diagnostic.mjs
- route.ts
- 📋 Requisitos Previos
- AirPlayReceiverEngine
- index.ts
- 🚀 Instalación Rápida
- build
- ProjectionCanvas.tsx
- scripts
- DeviceInfo
- DeviceInfo
- package.json
- 🎮 Modos de Uso
- 🔧 Solución de Problemas
- samsung-watchdog.ps1
- Capability
- 🚀 Instalación Rápida
- 🎮 Modos de Uso
- scrcpy-engine.ts
- scrcpy-engine.ts
- DashboardView.tsx
- useRescueSync.ts
- Value
- 📱 Crear Accesos Directos en Android
- ViewShell.tsx
- local
- stream.ts
- CliInjectorView.tsx
- adb_fast.rs
- AppShell.tsx
- DeviceInfoPanel.tsx
- query
- windows-schema.json
- route.ts
- PermissionEntry
- getLockFile
- Header.tsx
- AppsView.tsx
- post_actions
- adb_shell
- paths.rs
- DashboardView.tsx
- Identifier
- Value
- get_logcat
- get_logcat
- compilerOptions
- tauri.conf.json
- silent_cmd
- .resolve
- file_operations_api.rs
- definitions
- safe_serial
- receive
- definitions
- emulator.rs
- run
- ThemeProvider.tsx
- ThemeProvider.tsx
- FlasherView.tsx
- properties
- get_or_start_session
- CliInjectorView.tsx
- properties
- permissions
- webviews
- permissions
- webviews
- adb_fast.rs
- screens
- FeatureErrorBoundary
- CapabilityRemote
- CapabilityRemote
- main.rs
- build_router
- query
- check_origin
- receiver_path
- check_origin
- execute
- Extraction
- desktop-schema.json
- windows-schema.json
- 🔧 Solución de Problemas
- Capability
- Capability
- dashboard-components.tsx
- Capability
- description
- description
- local
- build_router
- 🚀 Instalación Rápida
- 🎮 Modos de Uso
- Identifier
- next.config.ts
- next-env.d.ts
- postcss.config.mjs
- tailwind.config.ts

## God Nodes (most connected - your core abstractions)
1. `apiUrl()` - 77 edges
2. `apiUrl()` - 77 edges
3. `DeviceInfo` - 50 edges
4. `DeviceInfo` - 50 edges
5. `useAppStore` - 36 edges
6. `useAppStore` - 36 edges
7. `useTheme()` - 33 edges
8. `useTheme()` - 33 edges
9. `Button()` - 22 edges
10. `useActions()` - 22 edges

## Surprising Connections (you probably didn't know these)
- `post_actions()` --calls--> `adb_bin()`  [INFERRED]
  androproject-gui/src-tauri/src/server/actions_api.rs → androproject-gui/src-tauri/src/server/paths.rs
- `post_actions()` --calls--> `adb_shell()`  [INFERRED]
  androproject-gui/src-tauri/src/server/actions_api.rs → androproject-gui/src-tauri/src/server/paths.rs
- `post_actions()` --calls--> `captures_dir()`  [INFERRED]
  androproject-gui/src-tauri/src/server/actions_api.rs → androproject-gui/src-tauri/src/server/paths.rs
- `post_actions()` --calls--> `run_adb()`  [INFERRED]
  androproject-gui/src-tauri/src/server/actions_api.rs → androproject-gui/src-tauri/src/server/paths.rs
- `post_actions()` --calls--> `safe_serial()`  [INFERRED]
  androproject-gui/src-tauri/src/server/actions_api.rs → androproject-gui/src-tauri/src/server/paths.rs

## Import Cycles
- None detected.

## Communities (186 total, 21 thin omitted)

### Community 0 - "types.ts"
Cohesion: 0.11
Nodes (17): app, security, windows, withGlobalTauri, build, beforeDevCommand, devUrl, frontendDist (+9 more)

### Community 1 - "safeExec"
Cohesion: 0.38
Nodes (9): check(), Child, HashMap, Mutex, String, Value, screens(), start() (+1 more)

### Community 2 - "devDependencies"
Cohesion: 0.15
Nodes (13): definitions, Number, PermissionEntry, Target, Value, anyOf, description, anyOf (+5 more)

### Community 3 - "config.ts"
Cohesion: 0.19
Nodes (10): fastboot(), Drop, Json, Multipart, PathBuf, String, Value, run() (+2 more)

### Community 4 - "CommandResult"
Cohesion: 0.18
Nodes (15): FileListQuery, friendly_name(), get_app_icon(), get_upload_file(), post_apps(), IntoResponse, Json, Option (+7 more)

### Community 5 - "DashboardAppsPanel.tsx"
Cohesion: 0.10
Nodes (25): DeviceFrame(), DeviceFrameProps, KEY_TO_ANDROID, DeviceFrameHeader(), DeviceFrameHeaderProps, fmtTime(), DeviceNavControls(), DeviceNavControlsProps (+17 more)

### Community 6 - "webrtc.py"
Cohesion: 0.06
Nodes (35): BaseModel, FastAPI, MediaStreamTrack, ndarray, RTCConfiguration, RTCSessionDescription, offer(), OfferParameters (+27 more)

### Community 7 - "tools"
Cohesion: 0.07
Nodes (29): agent, linux, instructions, model, permission, prompt, steps, bash (+21 more)

### Community 8 - "validation.ts"
Cohesion: 0.24
Nodes (10): apply(), Value, status(), apply(), read(), Value, run_maintenance(), adb_shell() (+2 more)

### Community 9 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 10 - "andro.ps1"
Cohesion: 0.17
Nodes (16): AirPlayStudioCardProps, DeviceInfoPanel(), DeviceInfoPanelProps, ToggleRow(), ToolButton(), formatTime(), ProjectionToolsCard(), ProjectionToolsCardProps (+8 more)

### Community 11 - "main.js"
Cohesion: 0.15
Nodes (13): definitions, Number, PermissionEntry, Target, Value, anyOf, description, anyOf (+5 more)

### Community 12 - "route.ts"
Cohesion: 0.08
Nodes (46): Badge(), BadgeProps, BadgeSize, BadgeTone, sizeClasses, toneClasses, Button(), ButtonProps (+38 more)

### Community 13 - "route.ts"
Cohesion: 0.16
Nodes (26): adb_bin(), has_adb_error(), is_valid_package(), is_valid_serial(), launch_package_native(), NativeAppInfo, parse_pkg_set(), HashSet (+18 more)

### Community 14 - "FeatureErrorBoundary"
Cohesion: 0.22
Nodes (3): FeatureErrorBoundary, Props, State

### Community 15 - "page.tsx"
Cohesion: 0.13
Nodes (28): CameraRefsBundle, captureVideoSnapshot(), disposeCameraResources(), listVideoInputs(), requestCameraStream(), startWebmRecording(), CameraActivityLogs(), CameraMetricsGrid() (+20 more)

### Community 17 - "IDeviceService"
Cohesion: 0.12
Nodes (17): 🔄 Actualización, ⌨️ Comandos Rápidos, 📱 Crear Accesos Directos en Android, En tu dispositivo Android:, 🎯 Flujo de Trabajo Recomendado, 🚀 Instalación Rápida (Un Solo Comando), 📱 Instrucciones de Uso - Kali Linux en Android, Método Automático: (+9 more)

### Community 18 - "layout.tsx"
Cohesion: 0.29
Nodes (18): adb(), adb-sh(), Connect-Phone(), Ensure-Connected(), Enter-MSF(), Enter-Shell(), Invoke-Tool(), Open-VNC() (+10 more)

### Community 19 - "route.ts"
Cohesion: 0.16
Nodes (27): LogcatConsoleView(), LogcatConsoleViewProps, LogcatCrashVault(), LogcatCrashVaultProps, LogcatHeaderBar(), LogcatHeaderBarProps, buildActiveAppDiagnosis(), DeduplicatedCrash (+19 more)

### Community 26 - "auto-install-kali-complete.sh"
Cohesion: 0.17
Nodes (10): Get-DeviceWifiIp(), Get-MdnsTargets(), Get-WirelessAttachedDevices(), Invoke-Adb(), Invoke-DeviceHardening(), Start-Projection(), Stop-ScrcpyIfRunning(), Test-AdbHealth() (+2 more)

### Community 27 - "check-mobile.sh"
Cohesion: 0.13
Nodes (14): 1. Conectar tu Oppo a la misma red WiFi, 2. Abrir Termux en tu Oppo, 3. Dar permisos de almacenamiento, 4. Descargar el script de instalación, 5. Dar permisos de ejecución, 6. Ejecutar la instalación, 📦 Archivos Disponibles para Descargar:, 🚀 Después de la Instalación: (+6 more)

### Community 28 - "create-shortcuts.sh"
Cohesion: 0.15
Nodes (13): Acceso Directo Manual, 🔄 Actualización, ⌨️ Comandos Rápidos (Aliases), 🤝 Contribuciones, 📱 Crear Accesos Directos en Android, Kali Linux en Termux - Instalación Automatizada, ⚖️ Licencia, ⚠️ Notas Importantes (+5 more)

### Community 29 - "AppShell.tsx"
Cohesion: 0.21
Nodes (20): get_config(), get_device(), get_device_image(), list_adb_devices(), Json, Option, Query, Response (+12 more)

### Community 30 - "INSTALL-OPPO-DIRECTO.sh"
Cohesion: 0.32
Nodes (3): Get-Category(), Get-PackageSnapshot(), Invoke-Adb()

### Community 31 - "setup-vnc-password.sh"
Cohesion: 0.39
Nodes (6): Get-OnlineDevices(), Get-WifiIp(), Invoke-Adb(), Invoke-Hardening(), Start-RescueScrcpy(), Stop-Scrcpy()

### Community 32 - "start-desktop.sh"
Cohesion: 0.15
Nodes (21): is_dangerous_shell(), json_ok(), post_actions(), record_pids(), HashMap, IntoResponse, Json, Mutex (+13 more)

### Community 34 - "transfer-to-phone.sh"
Cohesion: 0.12
Nodes (16): extract(), Extraction, Drop, PathBuf, Value, Vec, diagnose(), Value (+8 more)

### Community 36 - "NavSection"
Cohesion: 0.24
Nodes (13): canonical_file(), delete(), download(), FileRequest, PartialFile, quote(), Drop, Json (+5 more)

### Community 37 - "create_shortcut.ps1"
Cohesion: 0.06
Nodes (42): DeviceFrame(), DeviceFrameProps, KEY_TO_ANDROID, DeviceFrameHeader(), DeviceFrameHeaderProps, fmtTime(), DeviceNavControls(), DeviceNavControlsProps (+34 more)

### Community 38 - "hashcat.ps1"
Cohesion: 0.47
Nodes (5): SystemLogs, createSystemLogEntry(), SystemLogType, useSystemLogs(), UseSystemLogsResult

### Community 49 - "route.ts"
Cohesion: 0.06
Nodes (45): Badge(), BadgeProps, BadgeSize, BadgeTone, sizeClasses, toneClasses, Button(), ButtonProps (+37 more)

### Community 51 - "detect.ts"
Cohesion: 0.47
Nodes (5): DriverRequest, Json, String, Value, run()

### Community 53 - "AndroidProject 📱⚡"
Cohesion: 0.29
Nodes (6): AndroidProject 📱⚡, 🚀 Características Principales, ⚙️ Instalación (Entorno de Desarrollo), 🛡️ Seguridad y Arquitectura, 💻 Tecnologías Utilizadas, 📸 Vistazo al Dashboard

### Community 54 - "index.ts"
Cohesion: 0.10
Nodes (30): AirPlayServerStatus, AnimScales, AppPackage, BluetoothInfo, DeviceData, DeviceListItem, DiagnosticsData, DiagnosticsStorage (+22 more)

### Community 55 - "AndroProject - Instalador Oficial"
Cohesion: 0.33
Nodes (5): AndroProject - Instalador Oficial, Como generar el instalador, Estructura de carpetas, Que hace el instalador al ejecutarse, Requisitos del sistema

### Community 59 - "route.ts"
Cohesion: 0.18
Nodes (10): name, private, scripts, build, dev, electron, electron:build, electron:dev (+2 more)

### Community 60 - "paths.rs"
Cohesion: 0.05
Nodes (40): dependencies, lucide-react, multicast-dns, next, react, react-dom, @yume-chan/adb, @yume-chan/adb-scrcpy (+32 more)

### Community 61 - "Button.tsx"
Cohesion: 0.05
Nodes (40): dependencies, lucide-react, multicast-dns, next, react, react-dom, @yume-chan/adb, @yume-chan/adb-scrcpy (+32 more)

### Community 62 - "page.tsx"
Cohesion: 0.09
Nodes (34): AppShell(), AppShellProps, AutoDetectionToast(), AutoDetectionToastProps, DeviceManagerDropdown(), DeviceManagerDropdownProps, Header(), HeaderProps (+26 more)

### Community 63 - "🔧 Solución de Problemas"
Cohesion: 0.12
Nodes (28): PopoutContent(), buildDragSwipePayload(), buildWheelSwipePayload(), clamp(), clamp01(), DevicePoint, mapClientToDeviceCoords(), TouchRipple (+20 more)

### Community 64 - "Header.tsx"
Cohesion: 0.10
Nodes (28): AnimScales, AppPackage, BluetoothInfo, DeviceData, DeviceListItem, DiagnosticsData, DiagnosticsStorage, GpuTweaks (+20 more)

### Community 65 - "useAdbConnection.ts"
Cohesion: 0.38
Nodes (6): getTauri(), invokeRust(), isTauriDesktop(), NativeAppInfo, NativeDeviceMetrics, TauriInternals

### Community 66 - "📱 Crear Accesos Directos en Android"
Cohesion: 0.21
Nodes (12): APP_COLORS, AppsFilterDash, computeDeviceTelemetry(), DeviceTelemetrySummary, getAppColor(), parseTempNum(), TelemetryLevel, DashboardAppsPanel() (+4 more)

### Community 67 - "stream-diagnostic.mjs"
Cohesion: 0.33
Nodes (12): install_apk_native(), launch_avd(), launch_scrcpy_native(), list_avds(), resolve_adb_bin(), resolve_emulator_bin(), resolve_scrcpy_bin(), Option (+4 more)

### Community 68 - "route.ts"
Cohesion: 0.18
Nodes (15): IOSMirrorPage(), PopoutContent(), AirPlayStudioCard(), EmptyState(), EmptyStateProps, RealAppIcon(), RealAppIconProps, AppInstallerPanel() (+7 more)

### Community 69 - "📋 Requisitos Previos"
Cohesion: 0.43
Nodes (6): action(), receiver_path(), Option, PathBuf, Value, status()

### Community 72 - "AirPlayReceiverEngine"
Cohesion: 0.20
Nodes (10): properties, type, default, description, type, identifier, local, remote (+2 more)

### Community 73 - "index.ts"
Cohesion: 0.19
Nodes (15): filterAndSortApps(), formatBytes(), formatDate(), getErrorMessage(), summarizeAppThreats(), AppCard(), AppItemProps, AppRow() (+7 more)

### Community 74 - "🚀 Instalación Rápida"
Cohesion: 0.23
Nodes (12): install(), receive(), Drop, Json, Multipart, PathBuf, Result, StatusCode (+4 more)

### Community 75 - "build"
Cohesion: 0.20
Nodes (10): $ref, description, items, type, uniqueItems, description, items, type (+2 more)

### Community 76 - "ProjectionCanvas.tsx"
Cohesion: 0.20
Nodes (10): type, webviews, windows, items, description, items, type, description (+2 more)

### Community 77 - "scripts"
Cohesion: 0.20
Nodes (10): properties, type, default, description, type, identifier, local, remote (+2 more)

### Community 78 - "DeviceInfo"
Cohesion: 0.32
Nodes (7): ensure_rust_server(), is_port_open(), main(), open_device_popout(), AppHandle, Result, String

### Community 79 - "DeviceInfo"
Cohesion: 0.13
Nodes (27): buildDragSwipePayload(), buildWheelSwipePayload(), clamp(), clamp01(), DevicePoint, mapClientToDeviceCoords(), TouchRipple, ZoomState (+19 more)

### Community 80 - "package.json"
Cohesion: 0.20
Nodes (10): $ref, description, items, type, uniqueItems, description, items, type (+2 more)

### Community 81 - "🎮 Modos de Uso"
Cohesion: 0.13
Nodes (28): CameraRefsBundle, captureVideoSnapshot(), disposeCameraResources(), listVideoInputs(), requestCameraStream(), startWebmRecording(), CameraActivityLogs(), CameraMetricsGrid() (+20 more)

### Community 82 - "🔧 Solución de Problemas"
Cohesion: 0.33
Nodes (6): "Dependencias no instaladas", "Espacio insuficiente", "Kali no se inicia", "No se detectó Termux", "Sin interfaz gráfica", 🔧 Solución de Problemas

### Community 83 - "samsung-watchdog.ps1"
Cohesion: 0.20
Nodes (10): type, webviews, windows, items, description, items, type, description (+2 more)

### Community 84 - "Capability"
Cohesion: 0.40
Nodes (4): anyOf, description, $schema, title

### Community 85 - "🚀 Instalación Rápida"
Cohesion: 0.67
Nodes (3): fmtTime(), ProjectionToolbar(), ProjectionToolbarProps

### Community 86 - "🎮 Modos de Uso"
Cohesion: 0.50
Nodes (4): 1. Interfaz Gráfica (Recomendado), 2. Línea de Comandos, 3. VNC (Conexión Remota), 🎮 Formas de Usar Kali Linux

### Community 87 - "scrcpy-engine.ts"
Cohesion: 0.25
Nodes (8): description, properties, required, type, CapabilityRemote, urls, description, type

### Community 88 - "scrcpy-engine.ts"
Cohesion: 0.25
Nodes (8): description, properties, required, type, CapabilityRemote, urls, description, type

### Community 91 - "DashboardView.tsx"
Cohesion: 0.16
Nodes (27): LogcatConsoleView(), LogcatConsoleViewProps, LogcatCrashVault(), LogcatCrashVaultProps, LogcatHeaderBar(), LogcatHeaderBarProps, buildActiveAppDiagnosis(), DeduplicatedCrash (+19 more)

### Community 94 - "useRescueSync.ts"
Cohesion: 0.22
Nodes (9): FlashPartitionSpec, PARTITIONS, FlasherBootloaderPanel(), FlasherBootloaderPanelProps, BOOTABLE_PARTITIONS, FlasherImagePanel(), FlasherImagePanelProps, FlasherView() (+1 more)

### Community 95 - "Value"
Cohesion: 0.11
Nodes (28): Page(), QuickAction(), QuickActionProps, ThemeProps, ViewShell(), CliInjectorView(), DeviceSettingsPanel(), DeviceSettingsPanelProps (+20 more)

### Community 97 - "📱 Crear Accesos Directos en Android"
Cohesion: 0.15
Nodes (22): IOSMirrorPage(), Page(), ArchivosView(), CliInjectorView(), DeviceSettingsPanel(), DeviceSettingsPanelProps, LiveAndroidSettings, ConfigView() (+14 more)

### Community 98 - "ViewShell.tsx"
Cohesion: 0.50
Nodes (4): default, description, type, description

### Community 99 - "local"
Cohesion: 0.50
Nodes (4): default, description, type, description

### Community 100 - "stream.ts"
Cohesion: 0.67
Nodes (3): Identifier, description, oneOf

### Community 101 - "CliInjectorView.tsx"
Cohesion: 0.16
Nodes (26): adb_bin(), has_adb_error(), is_valid_package(), is_valid_serial(), launch_package_native(), NativeAppInfo, parse_pkg_set(), HashSet (+18 more)

### Community 102 - "adb_fast.rs"
Cohesion: 0.42
Nodes (9): adb_bin(), adb_key_fast(), adb_list_devices_fast(), FastDevice, launch_multi_scrcpy_native(), PathBuf, Result, String (+1 more)

### Community 104 - "AppShell.tsx"
Cohesion: 0.11
Nodes (20): AppShell(), AppShellProps, AutoDetectionToast(), AutoDetectionToastProps, groups, NavItemDef, Sidebar(), SidebarProps (+12 more)

### Community 105 - "DeviceInfoPanel.tsx"
Cohesion: 0.16
Nodes (18): AirPlayStudioCard(), AirPlayStudioCardProps, DeviceInfoPanelProps, ToggleRow(), ToolButton(), formatTime(), ProjectionToolsCard(), ProjectionToolsCardProps (+10 more)

### Community 106 - "query"
Cohesion: 0.25
Nodes (7): query(), AsRef, OsStr, Result, String, Value, scan()

### Community 107 - "windows-schema.json"
Cohesion: 0.40
Nodes (4): anyOf, description, $schema, title

### Community 115 - "route.ts"
Cohesion: 0.20
Nodes (9): 1. Vistas Reales Actualizadas (Hardware Físico), 2. Mapa de Flujo: Proyección Android 60 FPS + Multi-Pantalla, 3. Mapa de Flujo: Ecosistema iOS desde Windows, 4. Mapa de Flujo: Root, Bootloader y Seguridad de Apps (Android), 5. Grafo de Conocimiento del Repositorio, Flasheador Fastboot, Bootloader y Estado Root, Mapa de Arquitectura y Flujos — AndroProject, Multi-Pantalla en Vivo (`SM-A307G` + `CPH2557` a 60 FPS WebCodecs H.264) (+1 more)

### Community 116 - "PermissionEntry"
Cohesion: 0.12
Nodes (25): ControlPayload, post_control(), Json, Option, Query, Response, SerialQuery, String (+17 more)

### Community 117 - "getLockFile"
Cohesion: 0.14
Nodes (11): 1. Proyección Multi-Pantalla Concurrente (60 FPS WebCodecs H.264), 2. Panel Principal y Telemetría en Tiempo Real, 3. Gestor de Arranque, Bootloader, Particiones Fastboot y Sideload, Capturas Reales Actualizadas, Code signing policy, Demos en Video (Transmisión Móvil & Suite Dark/Light), Demos en Vivo (Reproducción Automática en GitHub), Documentación Completa (+3 more)

### Community 118 - "Header.tsx"
Cohesion: 0.17
Nodes (19): DeviceManagerDropdown(), DeviceManagerDropdownProps, Header(), HeaderProps, useAppTheme(), AdbDevice, AdbStatusResponse, loadRegisteredDevices() (+11 more)

### Community 119 - "AppsView.tsx"
Cohesion: 0.18
Nodes (15): filterAndSortApps(), formatBytes(), formatDate(), getErrorMessage(), summarizeAppThreats(), AppInstallerPanel(), AppInstallerPanelProps, AppCard() (+7 more)

### Community 120 - "post_actions"
Cohesion: 0.15
Nodes (21): is_dangerous_shell(), json_ok(), post_actions(), record_pids(), HashMap, IntoResponse, Json, Mutex (+13 more)

### Community 121 - "adb_shell"
Cohesion: 0.13
Nodes (19): extract(), Value, discover(), execute(), Json, StatusCode, Value, apply() (+11 more)

### Community 122 - "paths.rs"
Cohesion: 0.21
Nodes (20): get_config(), get_device(), get_device_image(), list_adb_devices(), Json, Option, Query, Response (+12 more)

### Community 124 - "DashboardView.tsx"
Cohesion: 0.17
Nodes (14): RealAppIcon(), RealAppIconProps, APP_COLORS, AppsFilterDash, computeDeviceTelemetry(), DeviceTelemetrySummary, getAppColor(), parseTempNum() (+6 more)

### Community 125 - "Identifier"
Cohesion: 0.67
Nodes (3): Identifier, description, oneOf

### Community 126 - "Value"
Cohesion: 0.43
Nodes (6): clean_safe_whitespace(), collect_paths(), list_srp_symbols(), main(), Elimina trailing spaces y >2 líneas en blanco seguidas sin alterar código., Identifica símbolos principales para guiar extracción modular SRP.

### Community 127 - "get_logcat"
Cohesion: 0.17
Nodes (19): get_airplay(), get_drivers(), get_ios(), get_logcat(), get_security_scan(), post_airplay(), post_flash(), Event (+11 more)

### Community 128 - "get_logcat"
Cohesion: 0.17
Nodes (19): get_airplay(), get_drivers(), get_ios(), get_logcat(), get_security_scan(), post_airplay(), post_flash(), Event (+11 more)

### Community 129 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 130 - "tauri.conf.json"
Cohesion: 0.11
Nodes (17): app, security, windows, withGlobalTauri, build, beforeDevCommand, devUrl, frontendDist (+9 more)

### Community 131 - "silent_cmd"
Cohesion: 0.15
Nodes (14): diagnose(), Value, DriverRequest, Json, String, Value, run(), info() (+6 more)

### Community 134 - "file_operations_api.rs"
Cohesion: 0.24
Nodes (13): canonical_file(), delete(), download(), FileRequest, PartialFile, quote(), Drop, Json (+5 more)

### Community 135 - "definitions"
Cohesion: 0.13
Nodes (15): definitions, Identifier, Number, PermissionEntry, Target, Value, oneOf, anyOf (+7 more)

### Community 136 - "safe_serial"
Cohesion: 0.20
Nodes (14): FileListQuery, friendly_name(), get_app_icon(), get_upload_file(), post_apps(), IntoResponse, Json, Option (+6 more)

### Community 137 - "receive"
Cohesion: 0.23
Nodes (12): install(), receive(), Drop, Json, Multipart, PathBuf, Result, StatusCode (+4 more)

### Community 138 - "definitions"
Cohesion: 0.15
Nodes (13): definitions, Number, PermissionEntry, Target, Value, anyOf, description, anyOf (+5 more)

### Community 139 - "emulator.rs"
Cohesion: 0.33
Nodes (12): install_apk_native(), launch_avd(), launch_scrcpy_native(), list_avds(), resolve_adb_bin(), resolve_emulator_bin(), resolve_scrcpy_bin(), Option (+4 more)

### Community 140 - "run"
Cohesion: 0.19
Nodes (10): fastboot(), Drop, Json, Multipart, PathBuf, String, Value, run() (+2 more)

### Community 141 - "ThemeProvider.tsx"
Cohesion: 0.26
Nodes (9): metadata, getServerTheme(), getTheme(), subscribeToTheme(), Theme, ThemeContext, ThemeContextValue, ThemeProvider() (+1 more)

### Community 142 - "ThemeProvider.tsx"
Cohesion: 0.26
Nodes (9): metadata, getServerTheme(), getTheme(), subscribeToTheme(), Theme, ThemeContext, ThemeContextValue, ThemeProvider() (+1 more)

### Community 143 - "FlasherView.tsx"
Cohesion: 0.24
Nodes (8): FlashPartitionSpec, PARTITIONS, FlasherBootloaderPanel(), FlasherBootloaderPanelProps, BOOTABLE_PARTITIONS, FlasherImagePanel(), FlasherImagePanelProps, FlasherViewProps

### Community 144 - "properties"
Cohesion: 0.18
Nodes (11): description, properties, required, type, Capability, description, type, identifier (+3 more)

### Community 145 - "get_or_start_session"
Cohesion: 0.12
Nodes (25): ControlPayload, post_control(), Json, Option, Query, Response, SerialQuery, String (+17 more)

### Community 146 - "CliInjectorView.tsx"
Cohesion: 0.29
Nodes (7): CliEngineSelector(), CliEngineSelectorProps, DiscoveryState, InjectorMode, CliResponseViewer(), CliResponseViewerProps, PRESETS

### Community 147 - "properties"
Cohesion: 0.20
Nodes (10): properties, type, default, description, type, identifier, local, remote (+2 more)

### Community 148 - "permissions"
Cohesion: 0.20
Nodes (10): $ref, description, items, type, uniqueItems, description, items, type (+2 more)

### Community 149 - "webviews"
Cohesion: 0.20
Nodes (10): type, webviews, windows, items, description, items, type, description (+2 more)

### Community 150 - "permissions"
Cohesion: 0.20
Nodes (10): $ref, description, items, type, uniqueItems, description, items, type (+2 more)

### Community 151 - "webviews"
Cohesion: 0.20
Nodes (10): type, webviews, windows, items, description, items, type, description (+2 more)

### Community 152 - "adb_fast.rs"
Cohesion: 0.42
Nodes (9): adb_bin(), adb_key_fast(), adb_list_devices_fast(), FastDevice, launch_multi_scrcpy_native(), PathBuf, Result, String (+1 more)

### Community 153 - "screens"
Cohesion: 0.38
Nodes (9): check(), Child, HashMap, Mutex, String, Value, screens(), start() (+1 more)

### Community 154 - "FeatureErrorBoundary"
Cohesion: 0.22
Nodes (3): FeatureErrorBoundary, Props, State

### Community 155 - "CapabilityRemote"
Cohesion: 0.25
Nodes (8): description, properties, required, type, CapabilityRemote, urls, description, type

### Community 156 - "CapabilityRemote"
Cohesion: 0.25
Nodes (8): description, properties, required, type, CapabilityRemote, urls, description, type

### Community 157 - "main.rs"
Cohesion: 0.32
Nodes (7): ensure_rust_server(), is_port_open(), main(), open_device_popout(), AppHandle, Result, String

### Community 158 - "build_router"
Cohesion: 0.67
Nodes (3): build_router(), Router, start_embedded_server()

### Community 159 - "query"
Cohesion: 0.25
Nodes (7): query(), AsRef, OsStr, Result, String, Value, scan()

### Community 160 - "check_origin"
Cohesion: 0.29
Nodes (6): check_origin(), Next, Request, Response, Result, StatusCode

### Community 161 - "receiver_path"
Cohesion: 0.43
Nodes (6): action(), receiver_path(), Option, PathBuf, Value, status()

### Community 162 - "check_origin"
Cohesion: 0.29
Nodes (6): check_origin(), Next, Request, Response, Result, StatusCode

### Community 163 - "execute"
Cohesion: 0.47
Nodes (5): discover(), execute(), Json, StatusCode, Value

### Community 164 - "Extraction"
Cohesion: 0.33
Nodes (4): Extraction, Drop, PathBuf, Vec

### Community 165 - "desktop-schema.json"
Cohesion: 0.40
Nodes (4): anyOf, description, $schema, title

### Community 166 - "windows-schema.json"
Cohesion: 0.40
Nodes (4): anyOf, description, $schema, title

### Community 167 - "🔧 Solución de Problemas"
Cohesion: 0.40
Nodes (5): El script no se ejecuta, Error de conexión VNC, Espacio insuficiente, La interfaz gráfica no inicia, 🔧 Solución de Problemas

### Community 168 - "Capability"
Cohesion: 0.50
Nodes (4): description, required, type, Capability

### Community 169 - "Capability"
Cohesion: 0.50
Nodes (4): description, required, type, Capability

### Community 170 - "dashboard-components.tsx"
Cohesion: 0.50
Nodes (3): QuickAction(), QuickActionProps, ThemeProps

### Community 171 - "Capability"
Cohesion: 0.50
Nodes (4): description, required, type, Capability

### Community 172 - "description"
Cohesion: 0.50
Nodes (4): default, description, type, description

### Community 173 - "description"
Cohesion: 0.50
Nodes (4): default, description, type, description

### Community 174 - "local"
Cohesion: 0.50
Nodes (4): default, description, type, local

### Community 175 - "build_router"
Cohesion: 0.67
Nodes (3): build_router(), Router, start_embedded_server()

### Community 176 - "🚀 Instalación Rápida"
Cohesion: 0.50
Nodes (4): 🚀 Instalación Rápida, Paso 1: Dar permisos de almacenamiento a Termux, Paso 2: Copiar el script de instalación, Paso 3: Ejecutar el script de instalación

### Community 177 - "🎮 Modos de Uso"
Cohesion: 0.50
Nodes (4): 🎮 Modos de Uso, Opción 1: Interfaz Gráfica (termux-x11) - Recomendado, Opción 2: Interfaz Gráfica (VNC), Opción 3: Línea de Comandos

### Community 178 - "Identifier"
Cohesion: 0.67
Nodes (3): Identifier, description, oneOf

## Knowledge Gaps
- **583 isolated node(s):** `eslintConfig`, `nextConfig`, `name`, `version`, `description` (+578 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **21 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `apiUrl()` connect `route.ts` to `📱 Crear Accesos Directos en Android`, `index.ts`, `DeviceInfo`, `route.ts`, `route.ts`, `useRescueSync.ts`, `page.tsx`, `Value`?**
  _High betweenness centrality (0.011) - this node is a cross-community bridge._
- **Why does `DeviceInfo` connect `DashboardAppsPanel.tsx` to `📱 Crear Accesos Directos en Android`, `route.ts`, `index.ts`, `andro.ps1`, `DeviceInfo`, `route.ts`, `index.ts`, `useRescueSync.ts`, `page.tsx`, `Value`?**
  _High betweenness centrality (0.006) - this node is a cross-community bridge._
- **Why does `apiUrl()` connect `📱 Crear Accesos Directos en Android` to `create_shortcut.ps1`, `AppShell.tsx`, `DeviceInfoPanel.tsx`, `route.ts`, `FlasherView.tsx`, `CliInjectorView.tsx`, `Header.tsx`, `AppsView.tsx`, `DashboardView.tsx`, `DashboardView.tsx`, `🔧 Solución de Problemas`?**
  _High betweenness centrality (0.006) - this node is a cross-community bridge._
- **What connects `eslintConfig`, `NOTE: This file should not be edited`, `nextConfig` to the rest of the system?**
  _600 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `types.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._
- **Should `DashboardAppsPanel.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.10338680926916222 - nodes in this community are weakly interconnected._
- **Should `webrtc.py` be split into smaller, more focused modules?**
  _Cohesion score 0.0595959595959596 - nodes in this community are weakly interconnected._