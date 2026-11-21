# Graph Report - AndroProject_Dev  (2026-11-21)

## Corpus Check
- 211 files · ~288,794 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1475 nodes · 2581 edges · 117 communities (96 shown, 21 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 10 edges (avg confidence: 0.71)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `3ae525e6`
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
- Capability
- Identifier
- description
- useAirPlayServer.ts

## God Nodes (most connected - your core abstractions)
1. `DeviceInfo` - 62 edges
2. `safeExec()` - 51 edges
3. `AirPlayReceiverEngine` - 30 edges
4. `useAppStore` - 28 edges
5. `useTheme()` - 22 edges
6. `useActions()` - 19 edges
7. `IAirPlayReceiverEngine` - 19 edges
8. `IosBridge` - 19 edges
9. `IIosBridge` - 18 edges
10. `NavSection` - 16 edges

## Surprising Connections (you probably didn't know these)
- `AutoDetectionToastProps` --references--> `DeviceInfo`  [EXTRACTED]
  androproject-gui/src/components/layout/AutoDetectionToast.tsx → androproject-gui/src/features/types.ts
- `SidebarProps` --references--> `NavSection`  [EXTRACTED]
  androproject-gui/src/components/layout/Sidebar.tsx → androproject-gui/src/features/types.ts
- `ArchivosViewProps` --references--> `DeviceInfo`  [EXTRACTED]
  androproject-gui/src/features/ArchivosView.tsx → androproject-gui/src/features/types.ts
- `FlasherViewProps` --references--> `DeviceInfo`  [EXTRACTED]
  androproject-gui/src/features/FlasherView.tsx → androproject-gui/src/features/types.ts
- `OptimizerViewProps` --references--> `DeviceInfo`  [EXTRACTED]
  androproject-gui/src/features/OptimizerView.tsx → androproject-gui/src/features/types.ts

## Import Cycles
- None detected.

## Communities (117 total, 21 thin omitted)

### Community 0 - "types.ts"
Cohesion: 0.11
Nodes (17): app, security, windows, withGlobalTauri, build, beforeDevCommand, devUrl, frontendDist (+9 more)

### Community 1 - "safeExec"
Cohesion: 0.06
Nodes (62): AppInfo, getPackageInfo(), KNOWN_HIDDEN_PACKAGES, listApps(), listPackages(), listRunning(), deduplicate(), detect() (+54 more)

### Community 2 - "devDependencies"
Cohesion: 0.13
Nodes (14): anyOf, definitions, Number, Target, Value, description, anyOf, description (+6 more)

### Community 4 - "CommandResult"
Cohesion: 0.10
Nodes (8): AppPackage, QuickActionItem, IAdbCommandExecutor, IDeviceService, INetworkRadarService, AdbConfig, CommandResult, ICommandExecutor

### Community 5 - "types.ts"
Cohesion: 0.05
Nodes (46): GET(), inFlightWorkers, lastGoodFrame, lastGoodFrameId, lastGoodTs, placeholderFrame(), pruneStaleCache(), triggerCapture() (+38 more)

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
Cohesion: 0.22
Nodes (14): startRecord(), stopRecord(), ANDROPROJECT_BIN, SCRCPY_SERVER_PATH, cleanupOrphanedLocks(), deleteLock(), execAsync, getLockFile() (+6 more)

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
Cohesion: 0.07
Nodes (27): 1. Interfaz Gráfica (Recomendado), 2. Línea de Comandos, 3. VNC (Conexión Remota), 🔄 Actualización, ⌨️ Comandos Rápidos, 📱 Crear Accesos Directos en Android, "Dependencias no instaladas", En tu dispositivo Android: (+19 more)

### Community 18 - "layout.tsx"
Cohesion: 0.07
Nodes (26): Acceso Directo Manual, 🔄 Actualización, ⌨️ Comandos Rápidos (Aliases), 🤝 Contribuciones, 📱 Crear Accesos Directos en Android, El script no se ejecuta, Error de conexión VNC, Espacio insuficiente (+18 more)

### Community 19 - "route.ts"
Cohesion: 0.13
Nodes (16): execAsync, runDiagnostic(), execAsync(), execAsyncOrig, GET(), LogcatEntry, LEVEL_COLORS, LogcatInspectorPanel() (+8 more)

### Community 48 - "📱 Instrucciones para Descargar e Instalar en Oppo"
Cohesion: 0.13
Nodes (14): 1. Conectar tu Oppo a la misma red WiFi, 2. Abrir Termux en tu Oppo, 3. Dar permisos de almacenamiento, 4. Descargar el script de instalación, 5. Dar permisos de ejecución, 6. Ejecutar la instalación, 📦 Archivos Disponibles para Descargar:, 🚀 Después de la Instalación: (+6 more)

### Community 49 - "route.ts"
Cohesion: 0.15
Nodes (15): Badge(), BadgeProps, BadgeSize, BadgeTone, sizeClasses, toneClasses, Card(), CardPadding (+7 more)

### Community 50 - "samsung-watchdog.ps1"
Cohesion: 0.17
Nodes (10): Get-DeviceWifiIp(), Get-MdnsTargets(), Get-WirelessAttachedDevices(), Invoke-Adb(), Invoke-DeviceHardening(), Start-Projection(), Stop-ScrcpyIfRunning(), Test-AdbHealth() (+2 more)

### Community 51 - "detect.ts"
Cohesion: 0.10
Nodes (21): DeviceFrame(), DeviceInfoPanel(), DeviceInfoPanelProps, EmptyState(), EmptyStateProps, MobileProjection(), MobileProjectionProps, ProjectionToolbar() (+13 more)

### Community 52 - "debloat-driver.ps1"
Cohesion: 0.32
Nodes (3): Get-Category(), Get-PackageSnapshot(), Invoke-Adb()

### Community 53 - "AndroidProject 📱⚡"
Cohesion: 0.29
Nodes (6): AndroidProject 📱⚡, 🚀 Características Principales, ⚙️ Instalación (Entorno de Desarrollo), 🛡️ Seguridad y Arquitectura, 💻 Tecnologías Utilizadas, 📸 Vistazo al Dashboard

### Community 54 - "index.ts"
Cohesion: 0.08
Nodes (34): inter, metadata, plusJakartaSans, AppShell(), AutoDetectionToast(), AutoDetectionToastProps, DeviceManagerDropdown(), DeviceManagerDropdownProps (+26 more)

### Community 55 - "AndroProject - Instalador Oficial"
Cohesion: 0.33
Nodes (5): AndroProject - Instalador Oficial, Como generar el instalador, Estructura de carpetas, Que hace el instalador al ejecutarse, Requisitos del sistema

### Community 59 - "route.ts"
Cohesion: 0.18
Nodes (10): name, private, scripts, build, dev, electron, electron:build, electron:dev (+2 more)

### Community 60 - "index.ts"
Cohesion: 0.09
Nodes (7): inputText(), pasteClipboard(), setClipboard(), AirPlayServerStatus, DEFAULT_AIRPLAY_OPTIONS, IAirPlayReceiverEngine, VisionNanoResult

### Community 61 - "Button.tsx"
Cohesion: 0.05
Nodes (37): dependencies, lucide-react, multicast-dns, next, react-dom, @yume-chan/adb, @yume-chan/adb-scrcpy, @yume-chan/adb-server-node-tcp (+29 more)

### Community 62 - "DeviceInfoFetcher"
Cohesion: 0.14
Nodes (4): AirPlayReceiverEngine, execAsync, getLocalIpAndMac(), resolveAirPlayDir()

### Community 63 - "dashboard-components.tsx"
Cohesion: 0.15
Nodes (4): BLOCKED_PATTERNS, inputSwipe(), inputTap(), isValidPoint()

### Community 64 - "ConfigView.tsx"
Cohesion: 0.06
Nodes (58): checkBin(), CLAUDE_EXE, execFileAsync, GEMINI_JS, GET(), NPM_DIR, OLLAMA_EXE, POST() (+50 more)

### Community 65 - "paths.ts"
Cohesion: 0.18
Nodes (21): react, Page(), MultiScreenGrid(), QuickAction(), QuickActionProps, ThemeProps, AppsView(), ArchivosView() (+13 more)

### Community 67 - "stream-diagnostic.mjs"
Cohesion: 0.33
Nodes (12): install_apk_native(), launch_avd(), launch_scrcpy_native(), list_avds(), resolve_adb_bin(), resolve_emulator_bin(), resolve_scrcpy_bin(), Option (+4 more)

### Community 68 - "route.ts"
Cohesion: 0.05
Nodes (24): captureOnce(), Ctrl, destroyIfEmpty(), EOI, FrameBroadcaster, GET(), getOrCreate(), MjpegParser (+16 more)

### Community 69 - "paths.ts"
Cohesion: 0.35
Nodes (10): CRITICAL_PARTITIONS, FLASH_DIR, isValidSerial(), POST(), VALID_PARTITIONS, execAsyncOrig, extractCmdError(), FlashInspectionResult (+2 more)

### Community 72 - "AirPlayReceiverEngine"
Cohesion: 0.20
Nodes (10): properties, type, default, description, type, identifier, local, remote (+2 more)

### Community 73 - "route.ts"
Cohesion: 0.20
Nodes (3): IStreamTransport, IProjectionCoordinator, ProjectionCoordinator

### Community 74 - "route.ts"
Cohesion: 0.22
Nodes (10): getForegroundApp(), keyevent(), ServiceFactory, ServiceToken, TOKENS, createSessionId(), DeviceSession, IosDeviceInfo (+2 more)

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
Cohesion: 0.11
Nodes (21): DeviceFrameProps, DeviceNavControls(), DeviceNavControlsProps, DeviceScreenTile, DeviceScreenTileProps, MultiScreenGridProps, clamp(), clamp01() (+13 more)

### Community 80 - "package.json"
Cohesion: 0.20
Nodes (10): $ref, description, items, type, uniqueItems, description, items, type (+2 more)

### Community 81 - "route.ts"
Cohesion: 0.11
Nodes (27): AnimScales, BluetoothInfo, DeviceData, DeviceListItem, DiagnosticsData, DiagnosticsStorage, GpuTweaks, OptimizerSettings (+19 more)

### Community 82 - "ArchivosView.tsx"
Cohesion: 0.14
Nodes (16): Button(), ButtonProps, ButtonSize, ButtonVariant, sizeClasses, variantClasses, ViewShell(), CliEngineSelector() (+8 more)

### Community 83 - "samsung-watchdog.ps1"
Cohesion: 0.20
Nodes (10): type, webviews, windows, items, description, items, type, description (+2 more)

### Community 84 - "paths.ts"
Cohesion: 0.23
Nodes (11): formatBytes(), formatDate(), getErrorMessage(), AppInstallerPanel(), AppInstallerPanelProps, AppCard(), AppItemProps, AppRow() (+3 more)

### Community 85 - "ios-bridge.ts"
Cohesion: 0.20
Nodes (10): discoverAndroprojectBin(), discoverScrcpyServer(), findWingetScrcpy(), ADB_BUNDLED, ADB_SDK, ADB_SDK_ALT, DEBUG_LOG, FASTBOOT_BUNDLED (+2 more)

### Community 86 - "scrcpy-session-hub.ts"
Cohesion: 0.24
Nodes (13): POST(), GET(), buildTouchPacket(), classifyH264Payload(), packH264Frame(), ActiveSession, allocPort(), destroySession() (+5 more)

### Community 87 - "scrcpy-engine.ts"
Cohesion: 0.25
Nodes (8): description, properties, required, type, CapabilityRemote, urls, description, type

### Community 88 - "scrcpy-engine.ts"
Cohesion: 0.25
Nodes (8): description, properties, required, type, CapabilityRemote, urls, description, type

### Community 91 - "DashboardView.tsx"
Cohesion: 0.12
Nodes (17): UseStreamTrackerProps, RealAppIcon(), RealAppIconProps, ViewShellProps, APP_COLORS, AppsFilterDash, computeDeviceTelemetry(), DeviceTelemetrySummary (+9 more)

### Community 93 - "ToolsView.tsx"
Cohesion: 0.32
Nodes (4): DeviceSettingsPanel(), DeviceSettingsPanelProps, LiveAndroidSettings, ConfigViewProps

### Community 94 - "useRescueSync.ts"
Cohesion: 0.29
Nodes (7): FlashPartitionSpec, PARTITIONS, FlasherBootloaderPanel(), FlasherBootloaderPanelProps, FlasherImagePanel(), FlasherImagePanelProps, FlasherViewProps

### Community 95 - "page.tsx"
Cohesion: 0.33
Nodes (8): sendTouchEvent(), WebCodecsCanvas(), WebCodecsCanvasProps, bytesEqual(), concatBytes(), extractAvcCodec(), startWebCodecsH264Player(), WebCodecsPlayerCallbacks

### Community 97 - "useRescueSync.ts"
Cohesion: 0.50
Nodes (4): default, description, type, description

### Community 98 - "route.ts"
Cohesion: 0.60
Nodes (4): GET(), getAirPlayEngine(), POST(), container

### Community 99 - "useRescueSync.ts"
Cohesion: 0.38
Nodes (6): AppShellProps, SystemLogs, createSystemLogEntry(), SystemLogType, useSystemLogs(), UseSystemLogsResult

### Community 100 - "stream.ts"
Cohesion: 0.67
Nodes (3): Identifier, description, oneOf

### Community 101 - "desktop-schema.json"
Cohesion: 0.67
Nodes (3): PermissionEntry, anyOf, description

### Community 102 - "adb_fast.rs"
Cohesion: 0.42
Nodes (9): adb_bin(), adb_key_fast(), adb_list_devices_fast(), FastDevice, launch_multi_scrcpy_native(), PathBuf, Result, String (+1 more)

### Community 104 - "IVisionNanoEngine"
Cohesion: 0.17
Nodes (10): StreamSessionConfig, StreamSessionResult, AirPlayStreamTransport, airPlayTransport, ScrcpyStreamTransport, scrcpyTransport, AirPlayServerOptions, ProjectionLaunchOptions (+2 more)

### Community 105 - "route.ts"
Cohesion: 0.80
Nodes (4): GET(), getAirPlay(), getIosBridge(), POST()

### Community 108 - "ISessionManager"
Cohesion: 0.32
Nodes (7): getTauri(), invokeRust(), isTauriDesktop(), NativeAppInfo, NativeDeviceMetrics, rustBridge, TauriInternals

### Community 109 - "windows-schema.json"
Cohesion: 0.40
Nodes (4): anyOf, description, $schema, title

### Community 110 - "route.ts"
Cohesion: 0.83
Nodes (3): execFileAsync, getErrorMessage(), POST()

### Community 111 - "route.ts"
Cohesion: 0.83
Nodes (3): execFileAsync, getErrorMessage(), POST()

### Community 112 - "Capability"
Cohesion: 0.50
Nodes (4): description, required, type, Capability

### Community 113 - "Capability"
Cohesion: 0.50
Nodes (4): description, required, type, Capability

### Community 115 - "Identifier"
Cohesion: 0.67
Nodes (3): Identifier, description, oneOf

### Community 116 - "description"
Cohesion: 0.50
Nodes (4): default, description, type, description

## Knowledge Gaps
- **417 isolated node(s):** `INSTALL-OPPO-DIRECTO.sh script`, `eslintConfig`, `nextConfig`, `name`, `version` (+412 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **21 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `DeviceInfo` connect `DeviceInfo` to `paths.ts`, `useRescueSync.ts`, `CommandResult`, `IVisionNanoEngine`, `route.ts`, `route.ts`, `route.ts`, `ArchivosView.tsx`, `detect.ts`, `paths.ts`, `route.ts`, `index.ts`, `DeviceInfoFetcher`, `DashboardView.tsx`, `index.ts`, `useRescueSync.ts`?**
  _High betweenness centrality (0.084) - this node is a cross-community bridge._
- **Why does `dependencies` connect `Button.tsx` to `paths.ts`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._
- **Why does `react` connect `paths.ts` to `Button.tsx`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._
- **What connects `INSTALL-OPPO-DIRECTO.sh script`, `eslintConfig`, `NOTE: This file should not be edited` to the rest of the system?**
  _429 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `types.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._
- **Should `safeExec` be split into smaller, more focused modules?**
  _Cohesion score 0.06298904538341157 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._