# Graph Report - AndroProject_Dev  (2026-11-27)

## Corpus Check
- 238 files · ~394,936 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1475 nodes · 2787 edges · 137 communities (120 shown, 17 thin omitted)
- Extraction: 96% EXTRACTED · 4% INFERRED · 0% AMBIGUOUS · INFERRED: 119 edges (avg confidence: 0.79)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `ea90ac63`
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
- apps_catalog.rs
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
- 🔧 Solución de Problemas
- scrcpy-engine.ts
- scrcpy-engine.ts
- DashboardView.tsx
- useRescueSync.ts
- Value
- ViewShell.tsx
- local
- stream.ts
- run
- 📋 Requisitos Previos
- query
- route.ts
- PermissionEntry
- getLockFile
- DashboardView.tsx
- Identifier
- Value
- get_logcat
- local_llm.rs
- run_adb
- threat_forensics.rs
- receive
- .resolve
- apps_catalog.rs
- get_gpu_info
- navigation.rs
- page.tsx
- tauri-bridge.ts
- ThemeProvider.tsx
- get_or_start_session
- build_router
- Capability
- Capability

## God Nodes (most connected - your core abstractions)
1. `apiUrl()` - 86 edges
2. `DeviceInfo` - 50 edges
3. `useTheme()` - 37 edges
4. `useAppStore` - 36 edges
5. `adb_shell()` - 28 edges
6. `Button()` - 26 edges
7. `silent_cmd()` - 22 edges
8. `run_adb()` - 22 edges
9. `safe_serial()` - 20 edges
10. `useActions()` - 19 edges

## Surprising Connections (you probably didn't know these)
- `rust_app_action_fast()` --calls--> `is_critical_system_package()`  [INFERRED]
  androproject-gui/src-tauri/src/apps_native.rs → androproject-gui/src-tauri/src/apps_policy.rs
- `rust_app_action_fast()` --calls--> `is_valid_package()`  [INFERRED]
  androproject-gui/src-tauri/src/apps_native.rs → androproject-gui/src-tauri/src/apps_policy.rs
- `post_actions()` --calls--> `adb_bin()`  [INFERRED]
  androproject-gui/src-tauri/src/server/actions_api.rs → androproject-gui/src-tauri/src/server/paths.rs
- `post_actions()` --calls--> `adb_shell()`  [INFERRED]
  androproject-gui/src-tauri/src/server/actions_api.rs → androproject-gui/src-tauri/src/server/paths.rs
- `post_actions()` --calls--> `captures_dir()`  [INFERRED]
  androproject-gui/src-tauri/src/server/actions_api.rs → androproject-gui/src-tauri/src/server/paths.rs

## Import Cycles
- None detected.

## Communities (137 total, 17 thin omitted)

### Community 0 - "types.ts"
Cohesion: 0.11
Nodes (17): app, security, windows, withGlobalTauri, build, beforeDevCommand, devUrl, frontendDist (+9 more)

### Community 1 - "safeExec"
Cohesion: 0.35
Nodes (10): check(), Child, HashMap, Mutex, String, Value, screens(), shutdown() (+2 more)

### Community 2 - "devDependencies"
Cohesion: 0.15
Nodes (13): definitions, Number, PermissionEntry, Target, Value, anyOf, description, anyOf (+5 more)

### Community 3 - "config.ts"
Cohesion: 0.19
Nodes (10): fastboot(), Drop, Json, Multipart, PathBuf, String, Value, run() (+2 more)

### Community 4 - "CommandResult"
Cohesion: 0.21
Nodes (13): FileListQuery, get_app_icon(), get_upload_file(), post_apps(), IntoResponse, Json, Option, Query (+5 more)

### Community 5 - "DashboardAppsPanel.tsx"
Cohesion: 0.25
Nodes (12): DeviceInfoPanelProps, ToggleRow(), ToolButton(), formatTime(), ProjectionToolsCard(), ProjectionToolsCardProps, VisionNanoStudioCard(), VisionNanoStudioCardProps (+4 more)

### Community 6 - "webrtc.py"
Cohesion: 0.06
Nodes (35): BaseModel, FastAPI, MediaStreamTrack, ndarray, RTCConfiguration, RTCSessionDescription, offer(), OfferParameters (+27 more)

### Community 7 - "tools"
Cohesion: 0.07
Nodes (29): agent, linux, instructions, model, permission, prompt, steps, bash (+21 more)

### Community 8 - "validation.ts"
Cohesion: 0.14
Nodes (21): action(), finalized(), finished(), Recording, request_close(), Child, PathBuf, Value (+13 more)

### Community 9 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 10 - "andro.ps1"
Cohesion: 0.14
Nodes (16): DeviceFrame(), DeviceFrameProps, KEY_TO_ANDROID, DeviceFrameHeader(), DeviceFrameHeaderProps, fmtTime(), DeviceNavControls(), DeviceNavControlsProps (+8 more)

### Community 11 - "main.js"
Cohesion: 0.15
Nodes (13): definitions, Number, PermissionEntry, Target, Value, anyOf, description, anyOf (+5 more)

### Community 12 - "route.ts"
Cohesion: 0.21
Nodes (12): engineAvailable(), PRESETS, CliEngineSelector(), CliEngineSelectorProps, DiscoveryState, InjectorMode, SkillSummary, CliResponseViewer() (+4 more)

### Community 13 - "route.ts"
Cohesion: 0.10
Nodes (37): adb_bin(), adb_key_fast(), adb_list_devices_fast(), FastDevice, launch_multi_scrcpy_native(), PathBuf, Result, String (+29 more)

### Community 14 - "FeatureErrorBoundary"
Cohesion: 0.25
Nodes (3): FeatureErrorBoundary, Props, State

### Community 15 - "page.tsx"
Cohesion: 0.13
Nodes (29): CameraRefsBundle, captureVideoSnapshot(), disposeCameraResources(), listVideoInputs(), requestCameraStream(), resetCameraZoom(), startWebmRecording(), CameraActivityLogs() (+21 more)

### Community 17 - "IDeviceService"
Cohesion: 0.17
Nodes (11): 🔄 Actualización, ⌨️ Comandos Rápidos, 🎯 Flujo de Trabajo Recomendado, 🚀 Instalación Rápida (Un Solo Comando), 📱 Instrucciones de Uso - Kali Linux en Android, ⚠️ Notas Importantes, Opción 1: Instalación Automatizada Completa, 📦 Qué incluye Kali Linux (+3 more)

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
Cohesion: 0.08
Nodes (26): Acceso Directo Manual, 🔄 Actualización, ⌨️ Comandos Rápidos (Aliases), 🤝 Contribuciones, 📱 Crear Accesos Directos en Android, El script no se ejecuta, Error de conexión VNC, Espacio insuficiente (+18 more)

### Community 29 - "AppShell.tsx"
Cohesion: 0.20
Nodes (21): get_config(), get_device(), get_device_image(), list_adb_devices(), Json, Option, Query, Response (+13 more)

### Community 30 - "INSTALL-OPPO-DIRECTO.sh"
Cohesion: 0.32
Nodes (3): Get-Category(), Get-PackageSnapshot(), Invoke-Adb()

### Community 31 - "setup-vnc-password.sh"
Cohesion: 0.39
Nodes (6): Get-OnlineDevices(), Get-WifiIp(), Invoke-Adb(), Invoke-Hardening(), Start-RescueScrcpy(), Stop-Scrcpy()

### Community 32 - "start-desktop.sh"
Cohesion: 0.17
Nodes (19): is_dangerous_shell(), json_ok(), post_actions(), IntoResponse, Json, StatusCode, Value, build_screen_args() (+11 more)

### Community 34 - "transfer-to-phone.sh"
Cohesion: 0.24
Nodes (12): apply(), Value, status(), foreground(), read(), Value, apply(), apply_perf_profile() (+4 more)

### Community 36 - "NavSection"
Cohesion: 0.24
Nodes (13): canonical_file(), delete(), download(), FileRequest, PartialFile, quote(), Drop, Json (+5 more)

### Community 37 - "create_shortcut.ps1"
Cohesion: 0.29
Nodes (11): inspect_ui(), parse_center(), parse_ui_nodes(), Json, Option, Query, StatusCode, Value (+3 more)

### Community 38 - "hashcat.ps1"
Cohesion: 0.07
Nodes (39): Badge(), BadgeProps, BadgeSize, BadgeTone, sizeClasses, toneClasses, Button(), ButtonProps (+31 more)

### Community 49 - "route.ts"
Cohesion: 0.29
Nodes (7): APP_COLORS, computeDeviceTelemetry(), DeviceTelemetrySummary, parseTempNum(), TelemetryLevel, TelemetryModal(), TelemetryModalProps

### Community 51 - "detect.ts"
Cohesion: 0.16
Nodes (13): diagnose(), Value, DriverRequest, Json, String, Value, run(), info() (+5 more)

### Community 53 - "AndroidProject 📱⚡"
Cohesion: 0.29
Nodes (6): AndroidProject 📱⚡, 🚀 Características Principales, ⚙️ Instalación (Entorno de Desarrollo), 🛡️ Seguridad y Arquitectura, 💻 Tecnologías Utilizadas, 📸 Vistazo al Dashboard

### Community 54 - "apps_catalog.rs"
Cohesion: 0.15
Nodes (12): DeviceInfoPanel(), EmptyState(), EmptyStateProps, fmtTime(), ProjectionToolbar(), ProjectionToolbarProps, SplitDivider(), SplitDividerProps (+4 more)

### Community 55 - "AndroProject - Instalador Oficial"
Cohesion: 0.20
Nodes (8): Archivos del constructor, Compilar desde el repositorio, Instalador de ANDRO-IOS para Windows, ANDRO-IOS para Windows · 23 de noviembre de 2026, Archivos de la edición, Cambios y comprobaciones, Código del proyecto, Firma de esta compilación

### Community 59 - "route.ts"
Cohesion: 0.18
Nodes (10): name, private, scripts, build, dev, electron, electron:build, electron:dev (+2 more)

### Community 60 - "paths.rs"
Cohesion: 0.25
Nodes (6): extract(), Extraction, Drop, PathBuf, Value, Vec

### Community 61 - "Button.tsx"
Cohesion: 0.04
Nodes (46): dependencies, lucide-react, multicast-dns, next, react-dom, @yume-chan/adb, @yume-chan/adb-scrcpy, @yume-chan/adb-server-node-tcp (+38 more)

### Community 62 - "page.tsx"
Cohesion: 0.12
Nodes (24): OptimizerNetworkAudioPanelProps, AnimScales, DeviceData, DeviceListItem, DiagnosticsData, DiagnosticsStorage, GpuTweaks, AppsFilter (+16 more)

### Community 63 - "🔧 Solución de Problemas"
Cohesion: 0.17
Nodes (28): react, Page(), MultiScreenGrid(), QuickAction(), QuickActionProps, ThemeProps, ArchivosView(), CliInjectorView() (+20 more)

### Community 64 - "Header.tsx"
Cohesion: 0.42
Nodes (10): parse_colon_components(), parse_device_admins(), parse_launcher_packages(), parse_pkg_lines(), parse_third_party_packages(), HashSet, String, Value (+2 more)

### Community 65 - "useAdbConnection.ts"
Cohesion: 0.36
Nodes (8): connect(), open(), Child, Option, Result, String, TcpStream, Transport

### Community 66 - "📱 Crear Accesos Directos en Android"
Cohesion: 0.36
Nodes (7): clamp_output(), discover(), execute(), Json, StatusCode, String, Value

### Community 67 - "stream-diagnostic.mjs"
Cohesion: 0.33
Nodes (12): install_apk_native(), launch_avd(), launch_scrcpy_native(), list_avds(), resolve_adb_bin(), resolve_emulator_bin(), resolve_scrcpy_bin(), Option (+4 more)

### Community 68 - "route.ts"
Cohesion: 0.33
Nodes (5): MobileProjection(), MobileProjectionProps, useProjection(), RunFn, useProjectionActions()

### Community 69 - "📋 Requisitos Previos"
Cohesion: 0.43
Nodes (6): action(), receiver_path(), Option, PathBuf, Value, status()

### Community 72 - "AirPlayReceiverEngine"
Cohesion: 0.20
Nodes (10): properties, type, default, description, type, identifier, local, remote (+2 more)

### Community 73 - "index.ts"
Cohesion: 0.16
Nodes (15): filterAndSortApps(), formatBytes(), formatDate(), getErrorMessage(), AppInstallerPanel(), AppInstallerPanelProps, AppCard(), AppItemProps (+7 more)

### Community 74 - "🚀 Instalación Rápida"
Cohesion: 0.06
Nodes (51): metadata, AppShell(), AppShellProps, AutoDetectionToast(), AutoDetectionToastProps, DeviceManagerDropdown(), DeviceManagerDropdownProps, Header() (+43 more)

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
Cohesion: 0.33
Nodes (6): main(), open_device_popout(), report_startup_error(), Result, String, AppHandle

### Community 79 - "DeviceInfo"
Cohesion: 0.12
Nodes (28): PopoutContent(), buildDragSwipePayload(), buildWheelSwipePayload(), clamp(), clamp01(), DevicePoint, mapClientToDeviceCoords(), TouchRipple (+20 more)

### Community 80 - "package.json"
Cohesion: 0.20
Nodes (10): $ref, description, items, type, uniqueItems, description, items, type (+2 more)

### Community 81 - "🎮 Modos de Uso"
Cohesion: 0.50
Nodes (4): 1. Proyección Multi-Pantalla Concurrente (60 FPS WebCodecs H.264), 2. Panel Principal y Telemetría en Tiempo Real, 3. Gestor de Arranque, Bootloader, Particiones Fastboot y Sideload, Capturas Reales Actualizadas

### Community 82 - "🔧 Solución de Problemas"
Cohesion: 0.29
Nodes (6): Auditoría de ANDRO-IOS para Windows · 25 de noviembre de 2026, Certificado, Hallazgos que conviene corregir primero, Qué se comprobó, Referencias del código, Resultados por módulo

### Community 83 - "samsung-watchdog.ps1"
Cohesion: 0.20
Nodes (10): type, webviews, windows, items, description, items, type, description (+2 more)

### Community 84 - "Capability"
Cohesion: 0.33
Nodes (4): cpu_percent(), fetch_telemetry(), Option, Value

### Community 85 - "🚀 Instalación Rápida"
Cohesion: 0.67
Nodes (3): 📱 Crear Accesos Directos en Android, Método Automático:, Método Manual (Termux:Widgets):

### Community 86 - "🔧 Solución de Problemas"
Cohesion: 0.67
Nodes (3): En tu dispositivo Android:, Para dar permisos en Termux:, 📋 Requisitos Previos

### Community 87 - "scrcpy-engine.ts"
Cohesion: 0.25
Nodes (8): description, properties, required, type, CapabilityRemote, urls, description, type

### Community 88 - "scrcpy-engine.ts"
Cohesion: 0.25
Nodes (8): description, properties, required, type, CapabilityRemote, urls, description, type

### Community 91 - "DashboardView.tsx"
Cohesion: 0.33
Nodes (6): "Dependencias no instaladas", "Espacio insuficiente", "Kali no se inicia", "No se detectó Termux", "Sin interfaz gráfica", 🔧 Solución de Problemas

### Community 94 - "useRescueSync.ts"
Cohesion: 0.23
Nodes (9): FlashPartitionSpec, PARTITIONS, FlasherBootloaderPanel(), FlasherBootloaderPanelProps, BOOTABLE_PARTITIONS, FlasherImagePanel(), FlasherImagePanelProps, FlasherLiveMonitor() (+1 more)

### Community 95 - "Value"
Cohesion: 0.15
Nodes (12): ViewShell(), DeviceFileBrowser(), DeviceFileBrowserProps, RemoteEntry, DEST_FOLDERS, ConfigRow(), QuickNavBtn(), DeviceSettingsPanel() (+4 more)

### Community 98 - "ViewShell.tsx"
Cohesion: 0.50
Nodes (4): default, description, type, description

### Community 99 - "local"
Cohesion: 0.50
Nodes (4): default, description, type, description

### Community 100 - "stream.ts"
Cohesion: 0.67
Nodes (3): Identifier, description, oneOf

### Community 101 - "run"
Cohesion: 0.27
Nodes (8): discovery_reports_adb_executable_status(), missing_api_returns_json(), rejects_missing_key_and_invalid_android_settings(), Request, StatusCode, Vec, send(), Body

### Community 104 - "📋 Requisitos Previos"
Cohesion: 0.50
Nodes (4): 1. Interfaz Gráfica (Recomendado), 2. Línea de Comandos, 3. VNC (Conexión Remota), 🎮 Formas de Usar Kali Linux

### Community 106 - "query"
Cohesion: 0.29
Nodes (9): ios_usb(), query(), AsRef, OsStr, Result, String, Value, Vec (+1 more)

### Community 115 - "route.ts"
Cohesion: 0.20
Nodes (9): 1. Vistas Reales Actualizadas (Hardware Físico), 2. Mapa de Flujo: Proyección Android 60 FPS + Multi-Pantalla, 3. Mapa de Flujo: Ecosistema iOS desde Windows, 4. Mapa de Flujo: Root, Bootloader y Seguridad de Apps (Android), 5. Grafo de Conocimiento del Repositorio, Flasheador Fastboot, Bootloader y Estado Root, Mapa de Arquitectura y Flujos — AndroProject, Multi-Pantalla en Vivo (`SM-A307G` + `CPH2557` a 60 FPS WebCodecs H.264) (+1 more)

### Community 116 - "PermissionEntry"
Cohesion: 0.40
Nodes (4): anyOf, description, $schema, title

### Community 117 - "getLockFile"
Cohesion: 0.20
Nodes (8): Code signing policy, Compilación de Windows del 23 de noviembre de 2026, Demos en Video (Transmisión Móvil & Suite Dark/Light), Demos en Vivo (Reproducción Automática en GitHub), Documentación Completa, Explicación de Funciones por Módulo (100% Rust Nativo), Mapa de Arquitectura y Flujos (100% Rust Backend · Cero Node.js / Cero Python), Modo Oscuro 2026 vs Modo Claro

### Community 123 - "DashboardView.tsx"
Cohesion: 0.24
Nodes (8): RealAppIcon(), RealAppIconProps, AppsFilterDash, getAppColor(), DashboardAppsPanel(), DashboardAppsPanelProps, postActionRequest(), projectScreensBatch()

### Community 125 - "Identifier"
Cohesion: 0.67
Nodes (3): Identifier, description, oneOf

### Community 126 - "Value"
Cohesion: 0.43
Nodes (6): clean_safe_whitespace(), collect_paths(), list_srp_symbols(), main(), Elimina trailing spaces y >2 líneas en blanco seguidas sin alterar código., Identifica símbolos principales para guiar extracción modular SRP.

### Community 127 - "get_logcat"
Cohesion: 0.18
Nodes (18): get_airplay(), get_drivers(), get_ios(), get_logcat(), get_security_scan(), post_airplay(), post_flash(), IntoResponse (+10 more)

### Community 128 - "local_llm.rs"
Cohesion: 0.32
Nodes (12): cli_exists(), decode_chunked(), discover_engines(), local_http_json(), resolve_claude_cmd(), Option, Result, String (+4 more)

### Community 129 - "run_adb"
Cohesion: 0.36
Nodes (8): control(), disconnect(), discover(), enumerate(), String, Value, String, run_adb()

### Community 130 - "threat_forensics.rs"
Cohesion: 0.28
Nodes (14): collect_forensics(), explain_forensics_ai(), extract_field(), extract_line_val(), ForensicsQuery, get_forensics(), Json, Option (+6 more)

### Community 131 - "receive"
Cohesion: 0.23
Nodes (12): install(), receive(), Drop, Json, Multipart, PathBuf, Result, StatusCode (+4 more)

### Community 134 - "apps_catalog.rs"
Cohesion: 0.31
Nodes (12): fetch_apk_stats(), friendly_name(), list_apps(), parse_launcher_set(), parse_overlay_set(), parse_pkg_paths(), parse_pkg_set(), HashMap (+4 more)

### Community 136 - "get_gpu_info"
Cohesion: 0.39
Nodes (7): detect_gpu_family(), get_gpu_info(), post_gpu_action(), Json, Query, StatusCode, Value

### Community 137 - "navigation.rs"
Cohesion: 0.36
Nodes (6): key_code(), Option, Result, String, send(), validate()

### Community 138 - "page.tsx"
Cohesion: 0.48
Nodes (4): IOSMirrorPage(), AirPlayStudioCard(), AirPlayServerStatus, useAirPlayServer()

### Community 139 - "tauri-bridge.ts"
Cohesion: 0.21
Nodes (10): DeviceScreenTile, DeviceScreenTileProps, MultiScreenGridProps, getTauri(), invokeRust(), isTauriDesktop(), NativeAppInfo, NativeDeviceMetrics (+2 more)

### Community 141 - "ThemeProvider.tsx"
Cohesion: 0.40
Nodes (4): anyOf, description, $schema, title

### Community 145 - "get_or_start_session"
Cohesion: 0.13
Nodes (26): ControlPayload, post_control(), Json, Option, Query, Response, String, Value (+18 more)

### Community 158 - "build_router"
Cohesion: 0.50
Nodes (4): build_router(), Result, start_embedded_server(), Router

### Community 168 - "Capability"
Cohesion: 0.50
Nodes (4): description, required, type, Capability

### Community 169 - "Capability"
Cohesion: 0.50
Nodes (4): description, required, type, Capability

## Knowledge Gaps
- **359 isolated node(s):** `eslintConfig`, `nextConfig`, `name`, `version`, `description` (+354 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **17 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `apiUrl()` connect `🔧 Solución de Problemas` to `hashcat.ps1`, `index.ts`, `page.tsx`, `🚀 Instalación Rápida`, `route.ts`, `DeviceInfo`, `route.ts`, `apps_catalog.rs`, `page.tsx`, `DashboardView.tsx`, `useRescueSync.ts`, `Value`?**
  _High betweenness centrality (0.025) - this node is a cross-community bridge._
- **Why does `dependencies` connect `Button.tsx` to `🔧 Solución de Problemas`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **Why does `react` connect `🔧 Solución de Problemas` to `Button.tsx`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **Are the 25 inferred relationships involving `adb_shell()` (e.g. with `post_actions()` and `extract()`) actually correct?**
  _`adb_shell()` has 25 INFERRED edges - model-reasoned connections that need verification._
- **What connects `eslintConfig`, `NOTE: This file should not be edited`, `nextConfig` to the rest of the system?**
  _375 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `types.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._
- **Should `webrtc.py` be split into smaller, more focused modules?**
  _Cohesion score 0.0595959595959596 - nodes in this community are weakly interconnected._