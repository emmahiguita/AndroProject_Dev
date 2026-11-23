# Graph Report - AndroProject_Dev  (2026-11-22)

## Corpus Check
- 198 files · ~374,523 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1185 nodes · 2127 edges · 116 communities (99 shown, 17 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 60 edges (avg confidence: 0.77)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e02f29b5`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- types.ts
- safeExec
- devDependencies
- config.ts
- CommandResult
- types.ts
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
- install-kali-desktop-auto.sh
- INSTALL-OPPO-DIRECTO.sh
- setup-vnc-password.sh
- start-desktop.sh
- start-kali-vnc.sh
- transfer-to-phone.sh
- connect_phone.ps1
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
- desktop-schema.json
- 🎮 Formas de Usar Kali Linux
- 📱 Crear Accesos Directos en Android
- stream-diagnostic.mjs
- route.ts
- 📋 Requisitos Previos
- AirPlayReceiverEngine
- index.ts
- build
- ProjectionCanvas.tsx
- scripts
- DeviceInfo
- DeviceInfo
- package.json
- samsung-watchdog.ps1
- scrcpy-engine.ts
- scrcpy-engine.ts
- DashboardView.tsx
- useRescueSync.ts
- Value
- useRescueSync.ts
- ViewShell.tsx
- stream.ts
- CliInjectorView.tsx
- adb_fast.rs
- route.ts
- windows-schema.json
- getLockFile
- detectAirPlaySocketIps
- Identifier
- Value
- .resolve
- silent_cmd
- get_or_start_session
- build_router

## God Nodes (most connected - your core abstractions)
1. `DeviceInfo` - 50 edges
2. `useAppStore` - 36 edges
3. `useTheme()` - 33 edges
4. `Button()` - 22 edges
5. `useActions()` - 21 edges
6. `post_actions()` - 19 edges
7. `NavSection` - 16 edges
8. `compilerOptions` - 16 edges
9. `useCameraWebRtc()` - 14 edges
10. `📱 Instrucciones de Uso - Kali Linux en Android` - 14 edges

## Surprising Connections (you probably didn't know these)
- `post_actions()` --calls--> `build_screen_args()`  [INFERRED]
  androproject-gui/src-tauri/src/server/actions_api.rs → androproject-gui/src-tauri/src/server/extra_actions.rs
- `post_actions()` --calls--> `handle_get_adb_status()`  [INFERRED]
  androproject-gui/src-tauri/src/server/actions_api.rs → androproject-gui/src-tauri/src/server/extra_actions.rs
- `post_actions()` --calls--> `handle_list_cameras()`  [INFERRED]
  androproject-gui/src-tauri/src/server/actions_api.rs → androproject-gui/src-tauri/src/server/extra_actions.rs
- `post_actions()` --calls--> `handle_optimizer_query()`  [INFERRED]
  androproject-gui/src-tauri/src/server/actions_api.rs → androproject-gui/src-tauri/src/server/extra_actions.rs
- `post_actions()` --calls--> `adb_bin()`  [INFERRED]
  androproject-gui/src-tauri/src/server/actions_api.rs → androproject-gui/src-tauri/src/server/paths.rs

## Import Cycles
- None detected.

## Communities (116 total, 17 thin omitted)

### Community 0 - "types.ts"
Cohesion: 0.11
Nodes (17): app, security, windows, withGlobalTauri, build, beforeDevCommand, devUrl, frontendDist (+9 more)

### Community 1 - "safeExec"
Cohesion: 0.20
Nodes (11): DeviceScreenTile, DeviceScreenTileProps, MultiScreenGridProps, AppsViewProps, CurarViewProps, TurboBoostPanelProps, OptimizerViewProps, ToolsViewProps (+3 more)

### Community 2 - "devDependencies"
Cohesion: 0.15
Nodes (13): definitions, Number, PermissionEntry, Target, Value, anyOf, description, anyOf (+5 more)

### Community 3 - "config.ts"
Cohesion: 0.24
Nodes (8): DeviceFrame(), DeviceFrameProps, KEY_TO_ANDROID, DeviceFrameHeader(), DeviceFrameHeaderProps, fmtTime(), DeviceNavControls(), DeviceNavControlsProps

### Community 4 - "CommandResult"
Cohesion: 0.19
Nodes (20): FileListQuery, friendly_name(), get_app_icon(), get_upload_file(), post_apps(), post_install_apk(), post_upload_file(), IntoResponse (+12 more)

### Community 5 - "types.ts"
Cohesion: 0.21
Nodes (12): APP_COLORS, AppsFilterDash, computeDeviceTelemetry(), DeviceTelemetrySummary, getAppColor(), parseTempNum(), TelemetryLevel, DashboardAppsPanel() (+4 more)

### Community 6 - "webrtc.py"
Cohesion: 0.06
Nodes (35): BaseModel, FastAPI, MediaStreamTrack, ndarray, RTCConfiguration, RTCSessionDescription, offer(), OfferParameters (+27 more)

### Community 7 - "tools"
Cohesion: 0.07
Nodes (29): agent, linux, instructions, model, permission, prompt, steps, bash (+21 more)

### Community 8 - "validation.ts"
Cohesion: 0.18
Nodes (13): get_device(), get_device_image(), list_adb_devices(), Json, Option, Query, Response, String (+5 more)

### Community 9 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 10 - "andro.ps1"
Cohesion: 0.27
Nodes (11): AirPlayStudioCardProps, DeviceInfoPanelProps, ToggleRow(), ToolButton(), formatTime(), ProjectionToolsCard(), ProjectionToolsCardProps, VisionNanoStudioCard() (+3 more)

### Community 11 - "main.js"
Cohesion: 0.15
Nodes (13): definitions, Number, PermissionEntry, Target, Value, anyOf, description, anyOf (+5 more)

### Community 12 - "route.ts"
Cohesion: 0.32
Nodes (4): DeviceSettingsPanel(), DeviceSettingsPanelProps, LiveAndroidSettings, ConfigViewProps

### Community 13 - "route.ts"
Cohesion: 0.15
Nodes (27): adb_bin(), has_adb_error(), is_valid_package(), is_valid_serial(), launch_package_native(), NativeAppInfo, parse_pkg_set(), PathBuf (+19 more)

### Community 14 - "FeatureErrorBoundary"
Cohesion: 0.25
Nodes (3): FeatureErrorBoundary, Props, State

### Community 15 - "page.tsx"
Cohesion: 0.13
Nodes (28): CameraRefsBundle, captureVideoSnapshot(), disposeCameraResources(), listVideoInputs(), requestCameraStream(), startWebmRecording(), CameraActivityLogs(), CameraMetricsGrid() (+20 more)

### Community 17 - "IDeviceService"
Cohesion: 0.18
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

### Community 29 - "install-kali-desktop-auto.sh"
Cohesion: 0.38
Nodes (6): getTauri(), invokeRust(), isTauriDesktop(), NativeAppInfo, NativeDeviceMetrics, TauriInternals

### Community 30 - "INSTALL-OPPO-DIRECTO.sh"
Cohesion: 0.32
Nodes (3): Get-Category(), Get-PackageSnapshot(), Invoke-Adb()

### Community 31 - "setup-vnc-password.sh"
Cohesion: 0.39
Nodes (6): Get-OnlineDevices(), Get-WifiIp(), Invoke-Adb(), Invoke-Hardening(), Start-RescueScrcpy(), Stop-Scrcpy()

### Community 32 - "start-desktop.sh"
Cohesion: 0.28
Nodes (12): is_dangerous_shell(), json_ok(), post_actions(), record_pids(), HashMap, IntoResponse, Json, Mutex (+4 more)

### Community 34 - "transfer-to-phone.sh"
Cohesion: 0.50
Nodes (4): description, required, type, Capability

### Community 36 - "connect_phone.ps1"
Cohesion: 0.33
Nodes (7): QuickAction(), QuickActionProps, ThemeProps, postActionRequest(), postPatchRequest(), projectScreensBatch(), useActions()

### Community 37 - "create_shortcut.ps1"
Cohesion: 0.50
Nodes (4): 1. Proyección Multi-Pantalla Concurrente (60 FPS WebCodecs H.264), 2. Panel Principal y Telemetría en Tiempo Real, 3. Gestor de Arranque, Bootloader, Particiones Fastboot y Sideload, Capturas Reales Actualizadas

### Community 38 - "hashcat.ps1"
Cohesion: 0.07
Nodes (43): metadata, AppShell(), AppShellProps, AutoDetectionToast(), AutoDetectionToastProps, DeviceManagerDropdown(), DeviceManagerDropdownProps, Header() (+35 more)

### Community 49 - "route.ts"
Cohesion: 0.12
Nodes (18): Badge(), BadgeProps, BadgeSize, BadgeTone, sizeClasses, toneClasses, Input(), InputProps (+10 more)

### Community 51 - "detect.ts"
Cohesion: 0.31
Nodes (10): build_screen_args(), handle_get_adb_status(), handle_list_cameras(), handle_optimizer_query(), post_config(), read_live_android_settings(), Json, String (+2 more)

### Community 53 - "AndroidProject 📱⚡"
Cohesion: 0.29
Nodes (6): AndroidProject 📱⚡, 🚀 Características Principales, ⚙️ Instalación (Entorno de Desarrollo), 🛡️ Seguridad y Arquitectura, 💻 Tecnologías Utilizadas, 📸 Vistazo al Dashboard

### Community 54 - "index.ts"
Cohesion: 0.33
Nodes (6): MobileProjectionProps, useProjection(), RunFn, useProjectionActions(), DEFAULT_SCRCPY_OPTIONS, UseProjectionReturn

### Community 55 - "AndroProject - Instalador Oficial"
Cohesion: 0.33
Nodes (5): AndroProject - Instalador Oficial, Como generar el instalador, Estructura de carpetas, Que hace el instalador al ejecutarse, Requisitos del sistema

### Community 59 - "route.ts"
Cohesion: 0.18
Nodes (10): name, private, scripts, build, dev, electron, electron:build, electron:dev (+2 more)

### Community 60 - "paths.rs"
Cohesion: 0.58
Nodes (9): get_config(), adb_bin(), captures_dir(), fastboot_bin(), home_dir(), PathBuf, scrcpy_bin(), scrcpy_server_path() (+1 more)

### Community 61 - "Button.tsx"
Cohesion: 0.05
Nodes (39): dependencies, lucide-react, multicast-dns, next, react-dom, @yume-chan/adb, @yume-chan/adb-scrcpy, @yume-chan/adb-server-node-tcp (+31 more)

### Community 62 - "page.tsx"
Cohesion: 0.47
Nodes (4): IOSMirrorPage(), AirPlayStudioCard(), AirPlayServerStatus, useAirPlayServer()

### Community 63 - "🔧 Solución de Problemas"
Cohesion: 0.33
Nodes (6): "Dependencias no instaladas", "Espacio insuficiente", "Kali no se inicia", "No se detectó Termux", "Sin interfaz gráfica", 🔧 Solución de Problemas

### Community 64 - "desktop-schema.json"
Cohesion: 0.40
Nodes (4): anyOf, description, $schema, title

### Community 65 - "🎮 Formas de Usar Kali Linux"
Cohesion: 0.50
Nodes (4): 1. Interfaz Gráfica (Recomendado), 2. Línea de Comandos, 3. VNC (Conexión Remota), 🎮 Formas de Usar Kali Linux

### Community 66 - "📱 Crear Accesos Directos en Android"
Cohesion: 0.67
Nodes (3): 📱 Crear Accesos Directos en Android, Método Automático:, Método Manual (Termux:Widgets):

### Community 67 - "stream-diagnostic.mjs"
Cohesion: 0.33
Nodes (12): install_apk_native(), launch_avd(), launch_scrcpy_native(), list_avds(), resolve_adb_bin(), resolve_emulator_bin(), resolve_scrcpy_bin(), Option (+4 more)

### Community 68 - "route.ts"
Cohesion: 0.14
Nodes (13): DeviceInfoPanel(), EmptyState(), EmptyStateProps, MobileProjection(), fmtTime(), ProjectionToolbar(), ProjectionToolbarProps, SplitDivider() (+5 more)

### Community 69 - "📋 Requisitos Previos"
Cohesion: 0.67
Nodes (3): En tu dispositivo Android:, Para dar permisos en Termux:, 📋 Requisitos Previos

### Community 72 - "AirPlayReceiverEngine"
Cohesion: 0.20
Nodes (10): properties, type, default, description, type, identifier, local, remote (+2 more)

### Community 73 - "index.ts"
Cohesion: 0.06
Nodes (50): RealAppIcon(), RealAppIconProps, filterAndSortApps(), formatBytes(), formatDate(), getErrorMessage(), summarizeAppThreats(), AppInstallerPanel() (+42 more)

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
Nodes (7): ensure_rust_server(), is_port_open(), main(), open_device_popout(), Result, String, AppHandle

### Community 79 - "DeviceInfo"
Cohesion: 0.12
Nodes (27): buildDragSwipePayload(), buildWheelSwipePayload(), clamp(), clamp01(), DevicePoint, mapClientToDeviceCoords(), TouchRipple, ZoomState (+19 more)

### Community 80 - "package.json"
Cohesion: 0.20
Nodes (10): $ref, description, items, type, uniqueItems, description, items, type (+2 more)

### Community 83 - "samsung-watchdog.ps1"
Cohesion: 0.20
Nodes (10): type, webviews, windows, items, description, items, type, description (+2 more)

### Community 87 - "scrcpy-engine.ts"
Cohesion: 0.25
Nodes (8): description, properties, required, type, CapabilityRemote, urls, description, type

### Community 88 - "scrcpy-engine.ts"
Cohesion: 0.25
Nodes (8): description, properties, required, type, CapabilityRemote, urls, description, type

### Community 91 - "DashboardView.tsx"
Cohesion: 0.18
Nodes (12): Card(), CardPadding, CardProps, paddingClasses, ViewShell(), DeviceFileBrowser(), DeviceFileBrowserProps, RemoteEntry (+4 more)

### Community 94 - "useRescueSync.ts"
Cohesion: 0.27
Nodes (8): FlashPartitionSpec, PARTITIONS, FlasherBootloaderPanel(), FlasherBootloaderPanelProps, BOOTABLE_PARTITIONS, FlasherImagePanel(), FlasherImagePanelProps, FlasherViewProps

### Community 95 - "Value"
Cohesion: 0.21
Nodes (19): react, Page(), MultiScreenGrid(), ArchivosView(), CliInjectorView(), ConfigView(), ScreenshotPanel(), AntivirusPanel() (+11 more)

### Community 97 - "useRescueSync.ts"
Cohesion: 0.50
Nodes (4): default, description, type, description

### Community 98 - "ViewShell.tsx"
Cohesion: 0.50
Nodes (4): default, description, type, description

### Community 100 - "stream.ts"
Cohesion: 0.67
Nodes (3): Identifier, description, oneOf

### Community 101 - "CliInjectorView.tsx"
Cohesion: 0.12
Nodes (19): Button(), ButtonProps, ButtonSize, ButtonVariant, sizeClasses, variantClasses, CliEngineSelector(), CliEngineSelectorProps (+11 more)

### Community 102 - "adb_fast.rs"
Cohesion: 0.42
Nodes (9): adb_bin(), adb_key_fast(), adb_list_devices_fast(), FastDevice, launch_multi_scrcpy_native(), PathBuf, Result, String (+1 more)

### Community 115 - "route.ts"
Cohesion: 0.20
Nodes (9): 1. Vistas Reales Actualizadas (Hardware Físico), 2. Mapa de Flujo: Proyección Android 60 FPS + Multi-Pantalla, 3. Mapa de Flujo: Ecosistema iOS desde Windows, 4. Mapa de Flujo: Root, Bootloader y Seguridad de Apps (Android), 5. Grafo de Conocimiento del Repositorio, Flasheador Fastboot, Bootloader y Estado Root, Mapa de Arquitectura y Flujos — AndroProject, Multi-Pantalla en Vivo (`SM-A307G` + `CPH2557` a 60 FPS WebCodecs H.264) (+1 more)

### Community 116 - "windows-schema.json"
Cohesion: 0.40
Nodes (4): anyOf, description, $schema, title

### Community 117 - "getLockFile"
Cohesion: 0.20
Nodes (7): Code signing policy, Demos en Video (Transmisión Móvil & Suite Dark/Light), Demos en Vivo (Reproducción Automática en GitHub), Documentación Completa, Explicación de Funciones por Módulo (100% Rust Nativo), Mapa de Arquitectura y Flujos (100% Rust Backend · Cero Node.js / Cero Python), Modo Oscuro 2026 vs Modo Claro

### Community 122 - "detectAirPlaySocketIps"
Cohesion: 0.50
Nodes (4): description, required, type, Capability

### Community 125 - "Identifier"
Cohesion: 0.67
Nodes (3): Identifier, description, oneOf

### Community 126 - "Value"
Cohesion: 0.43
Nodes (6): clean_safe_whitespace(), collect_paths(), list_srp_symbols(), main(), Elimina trailing spaces y >2 líneas en blanco seguidas sin alterar código., Identifica símbolos principales para guiar extracción modular SRP.

### Community 140 - "silent_cmd"
Cohesion: 0.15
Nodes (22): silent_cmd(), get_airplay(), get_drivers(), get_ios(), get_logcat(), get_security_scan(), handle_ai_cli(), post_airplay() (+14 more)

### Community 145 - "get_or_start_session"
Cohesion: 0.12
Nodes (24): ControlPayload, post_control(), Json, Option, Query, Response, String, Value (+16 more)

### Community 158 - "build_router"
Cohesion: 0.67
Nodes (3): build_router(), start_embedded_server(), Router

## Knowledge Gaps
- **350 isolated node(s):** `eslintConfig`, `nextConfig`, `name`, `version`, `description` (+345 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **17 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `DeviceInfo` connect `safeExec` to `config.ts`, `route.ts`, `CliInjectorView.tsx`, `hashcat.ps1`, `types.ts`, `connect_phone.ps1`, `index.ts`, `andro.ps1`, `DeviceInfo`, `index.ts`, `DashboardView.tsx`, `useRescueSync.ts`, `Value`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **Why does `react` connect `Value` to `Button.tsx`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Why does `dependencies` connect `Button.tsx` to `Value`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **What connects `eslintConfig`, `NOTE: This file should not be edited`, `nextConfig` to the rest of the system?**
  _366 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `types.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._
- **Should `webrtc.py` be split into smaller, more focused modules?**
  _Cohesion score 0.0595959595959596 - nodes in this community are weakly interconnected._
- **Should `tools` be split into smaller, more focused modules?**
  _Cohesion score 0.06666666666666667 - nodes in this community are weakly interconnected._