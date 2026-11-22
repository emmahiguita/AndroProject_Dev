# Graph Report - AndroProject_Dev  (2026-11-22)

## Corpus Check
- 228 files · ~311,004 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1561 nodes · 2753 edges · 135 communities (109 shown, 26 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 11 edges (avg confidence: 0.69)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `cca82af0`
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
- index.ts
- Button.tsx
- DeviceInfoFetcher
- dashboard-components.tsx
- ConfigView.tsx
- paths.ts
- ViewShell.tsx
- stream-diagnostic.mjs
- route.ts
- paths.ts
- AirPlayReceiverEngine
- route.ts
- route.ts
- build
- ProjectionCanvas.tsx
- scripts
- DeviceInfo
- DeviceInfo
- package.json
- route.ts
- ArchivosView.tsx
- samsung-watchdog.ps1
- paths.ts
- ios-bridge.ts
- scrcpy-session-hub.ts
- scrcpy-engine.ts
- scrcpy-engine.ts
- DashboardView.tsx
- ToolsView.tsx
- useRescueSync.ts
- page.tsx
- useRescueSync.ts
- route.ts
- useRescueSync.ts
- stream.ts
- desktop-schema.json
- adb_fast.rs
- IVisionNanoEngine
- route.ts
- ISessionManager
- WebCodecsCanvas.tsx
- ISessionManager
- windows-schema.json
- route.ts
- route.ts
- Capability
- stream-manager.ts
- BinaryResolver
- route.ts
- description
- getLockFile
- IAdbExecutor
- StreamManager
- FrameBroadcaster
- DeviceDetector
- desktop-schema.json
- useAirPlayServer.ts
- Capability
- Identifier
- Value
- ServiceContainer
- useSystemLogs.ts
- windows-schema.json
- dashboard-components.tsx
- PermissionEntry
- 🎮 Modos de Uso
- 📱 Crear Accesos Directos en Android

## God Nodes (most connected - your core abstractions)
1. `DeviceInfo` - 63 edges
2. `safeExec()` - 51 edges
3. `AirPlayReceiverEngine` - 31 edges
4. `useAppStore` - 29 edges
5. `useTheme()` - 25 edges
6. `IAirPlayReceiverEngine` - 19 edges
7. `IosBridge` - 19 edges
8. `useActions()` - 18 edges
9. `IIosBridge` - 18 edges
10. `isValidDeviceSerial()` - 17 edges

## Surprising Connections (you probably didn't know these)
- `AutoDetectionToastProps` --references--> `DeviceInfo`  [EXTRACTED]
  androproject-gui/src/components/layout/AutoDetectionToast.tsx → androproject-gui/src/features/types.ts
- `SidebarProps` --references--> `NavSection`  [EXTRACTED]
  androproject-gui/src/components/layout/Sidebar.tsx → androproject-gui/src/features/types.ts
- `FlasherViewProps` --references--> `DeviceInfo`  [EXTRACTED]
  androproject-gui/src/features/FlasherView.tsx → androproject-gui/src/features/types.ts
- `OptimizerViewProps` --references--> `DeviceInfo`  [EXTRACTED]
  androproject-gui/src/features/OptimizerView.tsx → androproject-gui/src/features/types.ts
- `ToolsViewProps` --references--> `DeviceInfo`  [EXTRACTED]
  androproject-gui/src/features/ToolsView.tsx → androproject-gui/src/features/types.ts

## Import Cycles
- None detected.

## Communities (135 total, 26 thin omitted)

### Community 0 - "types.ts"
Cohesion: 0.11
Nodes (17): app, security, windows, withGlobalTauri, build, beforeDevCommand, devUrl, frontendDist (+9 more)

### Community 1 - "safeExec"
Cohesion: 0.06
Nodes (62): AppInfo, getPackageInfo(), KNOWN_HIDDEN_PACKAGES, listApps(), listPackages(), listRunning(), deduplicate(), detect() (+54 more)

### Community 2 - "devDependencies"
Cohesion: 0.15
Nodes (13): definitions, Number, PermissionEntry, Target, Value, anyOf, description, anyOf (+5 more)

### Community 4 - "CommandResult"
Cohesion: 0.08
Nodes (11): AppPackage, QuickActionItem, AdbCommandExecutor, execAsync, MockCommandExecutor, IAdbCommandExecutor, IDeviceService, INetworkRadarService (+3 more)

### Community 5 - "types.ts"
Cohesion: 0.16
Nodes (10): AdbExecResult, AdbExecutor, execAsync(), execAsyncOrig, IAdbExecutor, DetectedDevice, ScrcpyEngine, CaptureResult (+2 more)

### Community 6 - "webrtc.py"
Cohesion: 0.07
Nodes (29): BaseModel, FastAPI, MediaStreamTrack, ndarray, RTCSessionDescription, offer(), OfferParameters, WebRTC offer endpoint.     Receives an SDP offer from the frontend, sets up the (+21 more)

### Community 7 - "tools"
Cohesion: 0.07
Nodes (29): agent, linux, instructions, model, permission, prompt, steps, bash (+21 more)

### Community 8 - "validation.ts"
Cohesion: 0.06
Nodes (30): actionSchemas, adbShellSchema, adguardDnsSchema, animationBatchSchema, animationScaleSchema, autoBrightnessSchema, backgroundLimitSchema, baseActionSchema (+22 more)

### Community 9 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 10 - "andro.ps1"
Cohesion: 0.29
Nodes (18): adb(), adb-sh(), Connect-Phone(), Ensure-Connected(), Enter-MSF(), Enter-Shell(), Invoke-Tool(), Open-VNC() (+10 more)

### Community 11 - "main.js"
Cohesion: 0.15
Nodes (13): definitions, Number, PermissionEntry, Target, Value, anyOf, description, anyOf (+5 more)

### Community 12 - "route.ts"
Cohesion: 0.13
Nodes (22): startRecord(), stopRecord(), cleanupOrphanedLocks(), deleteLock(), execAsync, getLockFile(), getRecordLockFile(), isLockAlive() (+14 more)

### Community 13 - "route.ts"
Cohesion: 0.16
Nodes (24): adb_bin(), is_valid_package(), is_valid_serial(), NativeAppInfo, parse_pkg_set(), PathBuf, Result, String (+16 more)

### Community 14 - "FeatureErrorBoundary"
Cohesion: 0.25
Nodes (3): FeatureErrorBoundary, Props, State

### Community 15 - "page.tsx"
Cohesion: 0.29
Nodes (7): CameraTransmitter(), CandidatePairStats, EncodingWithPriority, getErrorMessage(), InboundVideoStats, RuntimeWindow, TurnServer

### Community 17 - "IDeviceService"
Cohesion: 0.14
Nodes (14): 🔄 Actualización, ⌨️ Comandos Rápidos, En tu dispositivo Android:, 🎯 Flujo de Trabajo Recomendado, 🚀 Instalación Rápida (Un Solo Comando), 📱 Instrucciones de Uso - Kali Linux en Android, ⚠️ Notas Importantes, Opción 1: Instalación Automatizada Completa (+6 more)

### Community 18 - "layout.tsx"
Cohesion: 0.15
Nodes (13): Acceso Directo Manual, 🔄 Actualización, ⌨️ Comandos Rápidos (Aliases), 🤝 Contribuciones, 📱 Crear Accesos Directos en Android, Kali Linux en Termux - Instalación Automatizada, ⚖️ Licencia, ⚠️ Notas Importantes (+5 more)

### Community 19 - "route.ts"
Cohesion: 0.13
Nodes (16): execAsync, runDiagnostic(), execAsync(), execAsyncOrig, GET(), LogcatEntry, LEVEL_COLORS, LogcatInspectorPanel() (+8 more)

### Community 48 - "📱 Instrucciones para Descargar e Instalar en Oppo"
Cohesion: 0.13
Nodes (14): 1. Conectar tu Oppo a la misma red WiFi, 2. Abrir Termux en tu Oppo, 3. Dar permisos de almacenamiento, 4. Descargar el script de instalación, 5. Dar permisos de ejecución, 6. Ejecutar la instalación, 📦 Archivos Disponibles para Descargar:, 🚀 Después de la Instalación: (+6 more)

### Community 49 - "route.ts"
Cohesion: 0.14
Nodes (21): Badge(), BadgeProps, BadgeSize, BadgeTone, sizeClasses, toneClasses, Card(), CardPadding (+13 more)

### Community 50 - "samsung-watchdog.ps1"
Cohesion: 0.17
Nodes (10): Get-DeviceWifiIp(), Get-MdnsTargets(), Get-WirelessAttachedDevices(), Invoke-Adb(), Invoke-DeviceHardening(), Start-Projection(), Stop-ScrcpyIfRunning(), Test-AdbHealth() (+2 more)

### Community 51 - "detect.ts"
Cohesion: 0.09
Nodes (29): DeviceFrame(), DeviceFrameProps, DeviceNavControls(), DeviceNavControlsProps, DeviceInfoPanel(), DeviceInfoPanelProps, MobileProjection(), MobileProjectionProps (+21 more)

### Community 52 - "debloat-driver.ps1"
Cohesion: 0.32
Nodes (3): Get-Category(), Get-PackageSnapshot(), Invoke-Adb()

### Community 53 - "AndroidProject 📱⚡"
Cohesion: 0.29
Nodes (6): AndroidProject 📱⚡, 🚀 Características Principales, ⚙️ Instalación (Entorno de Desarrollo), 🛡️ Seguridad y Arquitectura, 💻 Tecnologías Utilizadas, 📸 Vistazo al Dashboard

### Community 54 - "index.ts"
Cohesion: 0.13
Nodes (10): ADB, { app, BrowserWindow, Tray, Menu, nativeImage, shell, dialog }, createTray(), createWindow(), fs, getAssetPath(), http, path (+2 more)

### Community 55 - "AndroProject - Instalador Oficial"
Cohesion: 0.33
Nodes (5): AndroProject - Instalador Oficial, Como generar el instalador, Estructura de carpetas, Que hace el instalador al ejecutarse, Requisitos del sistema

### Community 59 - "route.ts"
Cohesion: 0.18
Nodes (10): name, private, scripts, build, dev, electron, electron:build, electron:dev (+2 more)

### Community 60 - "index.ts"
Cohesion: 0.11
Nodes (4): IOSMirrorPage(), AirPlayServerStatus, useAirPlayServer(), IAirPlayReceiverEngine

### Community 61 - "Button.tsx"
Cohesion: 0.05
Nodes (37): dependencies, lucide-react, multicast-dns, next, react-dom, @yume-chan/adb, @yume-chan/adb-scrcpy, @yume-chan/adb-server-node-tcp (+29 more)

### Community 62 - "DeviceInfoFetcher"
Cohesion: 0.06
Nodes (21): BLOCKED_PATTERNS, inputSwipe(), inputTap(), inputText(), isValidPoint(), pasteClipboard(), setClipboard(), GET() (+13 more)

### Community 63 - "dashboard-components.tsx"
Cohesion: 0.16
Nodes (13): DeviceInfo, DeviceInfoFetcher, dynamicTelemetryCache, IDeviceInfoFetcher, StaticProps, staticPropsCache, extractCpuTicks(), parseBatteryInfo() (+5 more)

### Community 64 - "ConfigView.tsx"
Cohesion: 0.16
Nodes (16): APKSIGNER_JAR, appendLog(), execAsync(), execAsyncOrig, getErrorMessage(), isValidPackageName(), isValidSerial(), KEYSTORE_FILE (+8 more)

### Community 65 - "paths.ts"
Cohesion: 0.18
Nodes (12): react, Page(), MultiScreenGrid(), ArchivosView(), DeviceSettingsPanel(), DeviceSettingsPanelProps, LiveAndroidSettings, ConfigView() (+4 more)

### Community 66 - "ViewShell.tsx"
Cohesion: 0.27
Nodes (13): APP_NAME_DICT, BLOATWARE_PACKAGES, CRITICAL_SYSTEM_PACKAGES, deriveAppName(), execAsync(), execAsyncOrig, getErrorMessage(), getMalwareClassification() (+5 more)

### Community 67 - "stream-diagnostic.mjs"
Cohesion: 0.33
Nodes (12): install_apk_native(), launch_avd(), launch_scrcpy_native(), list_avds(), resolve_adb_bin(), resolve_emulator_bin(), resolve_scrcpy_bin(), Option (+4 more)

### Community 68 - "route.ts"
Cohesion: 0.15
Nodes (16): captureOnce(), Ctrl, destroyIfEmpty(), EOI, GET(), getOrCreate(), MjpegParser, PART_SEP (+8 more)

### Community 69 - "paths.ts"
Cohesion: 0.35
Nodes (10): CRITICAL_PARTITIONS, FLASH_DIR, isValidSerial(), POST(), VALID_PARTITIONS, execAsyncOrig, extractCmdError(), FlashInspectionResult (+2 more)

### Community 72 - "AirPlayReceiverEngine"
Cohesion: 0.20
Nodes (10): properties, type, default, description, type, identifier, local, remote (+2 more)

### Community 73 - "route.ts"
Cohesion: 0.18
Nodes (4): IStreamTransport, IProjectionCoordinator, ProjectionCoordinator, VisionNanoResult

### Community 74 - "route.ts"
Cohesion: 0.19
Nodes (13): getForegroundApp(), keyevent(), GET(), getAirPlayEngine(), POST(), container, ServiceFactory, ServiceToken (+5 more)

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
Nodes (4): open_device_popout(), Result, String, AppHandle

### Community 79 - "DeviceInfo"
Cohesion: 0.10
Nodes (28): EmptyState(), EmptyStateProps, clamp(), clamp01(), mapClientToDeviceCoords(), TouchRipple, ZoomState, ProjectionCanvas() (+20 more)

### Community 80 - "package.json"
Cohesion: 0.20
Nodes (10): $ref, description, items, type, uniqueItems, description, items, type (+2 more)

### Community 81 - "route.ts"
Cohesion: 0.09
Nodes (31): UseStreamTrackerProps, ViewShellProps, DashboardViewProps, AnimScales, BluetoothInfo, DeviceData, DeviceListItem, DiagnosticsData (+23 more)

### Community 82 - "ArchivosView.tsx"
Cohesion: 0.11
Nodes (21): Button(), ButtonProps, ButtonSize, ButtonVariant, sizeClasses, variantClasses, QuickAction(), QuickActionProps (+13 more)

### Community 83 - "samsung-watchdog.ps1"
Cohesion: 0.20
Nodes (10): type, webviews, windows, items, description, items, type, description (+2 more)

### Community 84 - "paths.ts"
Cohesion: 0.22
Nodes (12): formatBytes(), formatDate(), getErrorMessage(), AppInstallerPanel(), AppInstallerPanelProps, AppCard(), AppItemProps, AppRow() (+4 more)

### Community 85 - "ios-bridge.ts"
Cohesion: 0.60
Nodes (4): ANDROPROJECT_BIN, discoverAndroprojectBin(), discoverScrcpyServer(), findWingetScrcpy()

### Community 86 - "scrcpy-session-hub.ts"
Cohesion: 0.22
Nodes (14): POST(), GET(), SCRCPY_SERVER_PATH, buildTouchPacket(), classifyH264Payload(), packH264Frame(), ActiveSession, allocPort() (+6 more)

### Community 87 - "scrcpy-engine.ts"
Cohesion: 0.25
Nodes (8): description, properties, required, type, CapabilityRemote, urls, description, type

### Community 88 - "scrcpy-engine.ts"
Cohesion: 0.25
Nodes (8): description, properties, required, type, CapabilityRemote, urls, description, type

### Community 91 - "DashboardView.tsx"
Cohesion: 0.17
Nodes (14): RealAppIcon(), RealAppIconProps, APP_COLORS, AppsFilterDash, computeDeviceTelemetry(), DeviceTelemetrySummary, getAppColor(), parseTempNum() (+6 more)

### Community 93 - "ToolsView.tsx"
Cohesion: 0.22
Nodes (12): detector, fetcher, GET(), NO_CACHE, selectTarget(), buildOfflineDevice(), detectHardwareFallback(), execAsync (+4 more)

### Community 94 - "useRescueSync.ts"
Cohesion: 0.27
Nodes (8): FlashPartitionSpec, PARTITIONS, FlasherBootloaderPanel(), FlasherBootloaderPanelProps, FlasherImagePanel(), FlasherImagePanelProps, FlasherView(), FlasherViewProps

### Community 97 - "useRescueSync.ts"
Cohesion: 0.50
Nodes (4): default, description, type, description

### Community 98 - "route.ts"
Cohesion: 0.36
Nodes (11): fetchPlayStoreFallback(), GET(), playUrlCache, assertValidPackageName(), CACHE_DIR, CachedIcon, execFileAsync, extractDeviceApkIcon() (+3 more)

### Community 99 - "useRescueSync.ts"
Cohesion: 0.29
Nodes (10): GET(), adbShell(), execFileAsync, parseAccessibilityPkgs(), parseAppOpsMap(), parseThirdPartyInstallers(), scanDeviceForSpyware(), SPY_OPS (+2 more)

### Community 100 - "stream.ts"
Cohesion: 0.67
Nodes (3): Identifier, description, oneOf

### Community 101 - "desktop-schema.json"
Cohesion: 0.27
Nodes (9): checkBin(), CLAUDE_EXE, execFileAsync, GEMINI_JS, GET(), NPM_DIR, OLLAMA_EXE, POST() (+1 more)

### Community 102 - "adb_fast.rs"
Cohesion: 0.42
Nodes (9): adb_bin(), adb_key_fast(), adb_list_devices_fast(), FastDevice, launch_multi_scrcpy_native(), PathBuf, Result, String (+1 more)

### Community 104 - "IVisionNanoEngine"
Cohesion: 0.35
Nodes (8): StreamSessionConfig, StreamSessionResult, AirPlayStreamTransport, airPlayTransport, scrcpyTransport, AirPlayServerOptions, ProjectionLaunchOptions, VisionNanoOptions

### Community 105 - "route.ts"
Cohesion: 0.80
Nodes (4): GET(), getAirPlay(), getIosBridge(), POST()

### Community 106 - "ISessionManager"
Cohesion: 0.07
Nodes (40): inter, metadata, plusJakartaSans, AppShell(), AppShellProps, AutoDetectionToast(), AutoDetectionToastProps, DeviceManagerDropdown() (+32 more)

### Community 108 - "ISessionManager"
Cohesion: 0.32
Nodes (7): getTauri(), invokeRust(), isTauriDesktop(), NativeAppInfo, NativeDeviceMetrics, rustBridge, TauriInternals

### Community 109 - "windows-schema.json"
Cohesion: 0.35
Nodes (9): execAsync, execFileAsync, GET(), LiveAndroidSettings, POST(), readAndroidSettings(), assertValidDeviceSerial(), isValidDeviceSerial() (+1 more)

### Community 110 - "route.ts"
Cohesion: 0.46
Nodes (6): execFileAsync, getErrorMessage(), POST(), execFileAsync, extractIosUdid(), installIpaBuffer()

### Community 111 - "route.ts"
Cohesion: 0.83
Nodes (3): execFileAsync, getErrorMessage(), POST()

### Community 113 - "stream-manager.ts"
Cohesion: 0.20
Nodes (7): BinaryCache, BOUNDARY, EOI, FrameHandlerConfig, SOI, StreamConfig, StreamState

### Community 115 - "route.ts"
Cohesion: 0.20
Nodes (9): 1. Vistas Reales Actualizadas (Hardware Físico), 2. Mapa de Flujo: Proyección Android 60 FPS + Multi-Pantalla, 3. Mapa de Flujo: Ecosistema iOS desde Windows, 4. Mapa de Flujo: Root, Bootloader y Seguridad de Apps (Android), 5. Grafo de Conocimiento del Repositorio, Flasheador Fastboot, Bootloader y Estado Root, Mapa de Arquitectura y Flujos — AndroProject, Multi-Pantalla en Vivo (`SM-A307G` + `CPH2557` a 60 FPS WebCodecs H.264) (+1 more)

### Community 116 - "description"
Cohesion: 0.50
Nodes (4): default, description, type, description

### Community 117 - "getLockFile"
Cohesion: 0.20
Nodes (7): 1. Proyección Multi-Pantalla Concurrente (60 FPS WebCodecs H.264), 2. Panel Principal y Telemetría en Tiempo Real, 3. Gestor de Arranque, Bootloader, Particiones Fastboot y Sideload, Capturas Reales Actualizadas, Documentación Completa, Explicación de Funciones por Módulo, Mapa de Arquitectura y Flujos

### Community 118 - "IAdbExecutor"
Cohesion: 0.33
Nodes (6): "Dependencias no instaladas", "Espacio insuficiente", "Kali no se inicia", "No se detectó Termux", "Sin interfaz gráfica", 🔧 Solución de Problemas

### Community 122 - "desktop-schema.json"
Cohesion: 0.50
Nodes (4): description, required, type, Capability

### Community 124 - "Capability"
Cohesion: 0.50
Nodes (4): description, required, type, Capability

### Community 125 - "Identifier"
Cohesion: 0.67
Nodes (3): Identifier, description, oneOf

### Community 126 - "Value"
Cohesion: 0.40
Nodes (4): anyOf, description, $schema, title

### Community 128 - "useSystemLogs.ts"
Cohesion: 0.40
Nodes (5): El script no se ejecuta, Error de conexión VNC, Espacio insuficiente, La interfaz gráfica no inicia, 🔧 Solución de Problemas

### Community 129 - "windows-schema.json"
Cohesion: 0.40
Nodes (4): anyOf, description, $schema, title

### Community 130 - "dashboard-components.tsx"
Cohesion: 0.50
Nodes (4): 1. Interfaz Gráfica (Recomendado), 2. Línea de Comandos, 3. VNC (Conexión Remota), 🎮 Formas de Usar Kali Linux

### Community 131 - "PermissionEntry"
Cohesion: 0.50
Nodes (4): 🚀 Instalación Rápida, Paso 1: Dar permisos de almacenamiento a Termux, Paso 2: Copiar el script de instalación, Paso 3: Ejecutar el script de instalación

### Community 132 - "🎮 Modos de Uso"
Cohesion: 0.50
Nodes (4): 🎮 Modos de Uso, Opción 1: Interfaz Gráfica (termux-x11) - Recomendado, Opción 2: Interfaz Gráfica (VNC), Opción 3: Línea de Comandos

### Community 133 - "📱 Crear Accesos Directos en Android"
Cohesion: 0.67
Nodes (3): 📱 Crear Accesos Directos en Android, Método Automático:, Método Manual (Termux:Widgets):

## Knowledge Gaps
- **439 isolated node(s):** `INSTALL-OPPO-DIRECTO.sh script`, `{ app, BrowserWindow, Tray, Menu, nativeImage, shell, dialog }`, `{ spawn }`, `path`, `fs` (+434 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **26 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `DeviceInfo` connect `detect.ts` to `paths.ts`, `CommandResult`, `IVisionNanoEngine`, `route.ts`, `ISessionManager`, `route.ts`, `DeviceInfo`, `route.ts`, `ArchivosView.tsx`, `route.ts`, `paths.ts`, `DeviceInfoFetcher`, `DashboardView.tsx`, `index.ts`, `ToolsView.tsx`, `useRescueSync.ts`?**
  _High betweenness centrality (0.104) - this node is a cross-community bridge._
- **Why does `react` connect `paths.ts` to `Button.tsx`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._
- **Why does `dependencies` connect `Button.tsx` to `paths.ts`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **What connects `INSTALL-OPPO-DIRECTO.sh script`, `{ app, BrowserWindow, Tray, Menu, nativeImage, shell, dialog }`, `{ spawn }` to the rest of the system?**
  _451 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `types.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._
- **Should `safeExec` be split into smaller, more focused modules?**
  _Cohesion score 0.06298904538341157 - nodes in this community are weakly interconnected._
- **Should `CommandResult` be split into smaller, more focused modules?**
  _Cohesion score 0.08258258258258258 - nodes in this community are weakly interconnected._