# Graph Report - AndroProject_Dev  (2026-11-21)

## Corpus Check
- 210 files · ~288,456 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1472 nodes · 2577 edges · 113 communities (94 shown, 19 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 10 edges (avg confidence: 0.71)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `93e95552`
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
- WebCodecsCanvas.tsx
- ISessionManager
- Capability
- Identifier
- description
- useAirPlayServer.ts
- Value

## God Nodes (most connected - your core abstractions)
1. `DeviceInfo` - 63 edges
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
- `AppsViewProps` --references--> `DeviceInfo`  [EXTRACTED]
  androproject-gui/src/features/AppsView.tsx → androproject-gui/src/features/types.ts
- `ArchivosViewProps` --references--> `DeviceInfo`  [EXTRACTED]
  androproject-gui/src/features/ArchivosView.tsx → androproject-gui/src/features/types.ts
- `CurarViewProps` --references--> `DeviceInfo`  [EXTRACTED]
  androproject-gui/src/features/CurarView.tsx → androproject-gui/src/features/types.ts
- `FlasherViewProps` --references--> `DeviceInfo`  [EXTRACTED]
  androproject-gui/src/features/FlasherView.tsx → androproject-gui/src/features/types.ts
- `OptimizerViewProps` --references--> `DeviceInfo`  [EXTRACTED]
  androproject-gui/src/features/OptimizerView.tsx → androproject-gui/src/features/types.ts

## Import Cycles
- None detected.

## Communities (113 total, 19 thin omitted)

### Community 0 - "types.ts"
Cohesion: 0.11
Nodes (17): app, security, windows, withGlobalTauri, build, beforeDevCommand, devUrl, frontendDist (+9 more)

### Community 1 - "safeExec"
Cohesion: 0.06
Nodes (62): AppInfo, getPackageInfo(), KNOWN_HIDDEN_PACKAGES, listApps(), listPackages(), listRunning(), deduplicate(), detect() (+54 more)

### Community 2 - "devDependencies"
Cohesion: 0.14
Nodes (14): description, required, type, definitions, Capability, Number, Target, Value (+6 more)

### Community 3 - "config.ts"
Cohesion: 0.07
Nodes (7): getForegroundApp(), keyevent(), execAsync, IIosBridge, IosBridge, IosDeviceInfo, IosWdaStatus

### Community 4 - "CommandResult"
Cohesion: 0.10
Nodes (6): IAdbCommandExecutor, IDeviceService, INetworkRadarService, AdbConfig, CommandResult, ICommandExecutor

### Community 5 - "types.ts"
Cohesion: 0.05
Nodes (40): GET(), inFlightWorkers, lastGoodFrame, lastGoodFrameId, lastGoodTs, placeholderFrame(), pruneStaleCache(), triggerCapture() (+32 more)

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
Cohesion: 0.13
Nodes (14): anyOf, definitions, Number, PermissionEntry, Target, description, anyOf, description (+6 more)

### Community 12 - "route.ts"
Cohesion: 0.08
Nodes (40): startRecord(), stopRecord(), CRITICAL_PARTITIONS, FLASH_DIR, isValidSerial(), POST(), VALID_PARTITIONS, execFileAsync (+32 more)

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
Cohesion: 0.23
Nodes (9): SidebarProps, ViewShell(), ViewShellProps, DashboardViewProps, OptimizerView(), OptimizerViewProps, NavSection, createUISlice() (+1 more)

### Community 50 - "samsung-watchdog.ps1"
Cohesion: 0.17
Nodes (10): Get-DeviceWifiIp(), Get-MdnsTargets(), Get-WirelessAttachedDevices(), Invoke-Adb(), Invoke-DeviceHardening(), Start-Projection(), Stop-ScrcpyIfRunning(), Test-AdbHealth() (+2 more)

### Community 51 - "detect.ts"
Cohesion: 0.11
Nodes (20): DeviceFrame(), DeviceInfoPanel(), DeviceInfoPanelProps, EmptyState(), EmptyStateProps, MobileProjection(), MobileProjectionProps, SplitDivider() (+12 more)

### Community 52 - "debloat-driver.ps1"
Cohesion: 0.32
Nodes (3): Get-Category(), Get-PackageSnapshot(), Invoke-Adb()

### Community 53 - "AndroidProject 📱⚡"
Cohesion: 0.29
Nodes (6): AndroidProject 📱⚡, 🚀 Características Principales, ⚙️ Instalación (Entorno de Desarrollo), 🛡️ Seguridad y Arquitectura, 💻 Tecnologías Utilizadas, 📸 Vistazo al Dashboard

### Community 54 - "index.ts"
Cohesion: 0.11
Nodes (27): AppShell(), DeviceManagerDropdown(), DeviceManagerDropdownProps, Header(), HeaderProps, groups, NavItemDef, Sidebar() (+19 more)

### Community 55 - "AndroProject - Instalador Oficial"
Cohesion: 0.33
Nodes (5): AndroProject - Instalador Oficial, Como generar el instalador, Estructura de carpetas, Que hace el instalador al ejecutarse, Requisitos del sistema

### Community 59 - "route.ts"
Cohesion: 0.18
Nodes (10): name, private, scripts, build, dev, electron, electron:build, electron:dev (+2 more)

### Community 60 - "index.ts"
Cohesion: 0.14
Nodes (3): AirPlayStreamTransport, AirPlayServerStatus, IAirPlayReceiverEngine

### Community 61 - "Button.tsx"
Cohesion: 0.05
Nodes (38): dependencies, lucide-react, multicast-dns, next, react, react-dom, @yume-chan/adb, @yume-chan/adb-scrcpy (+30 more)

### Community 62 - "DeviceInfoFetcher"
Cohesion: 0.07
Nodes (12): BLOCKED_PATTERNS, inputSwipe(), inputTap(), inputText(), isValidPoint(), pasteClipboard(), setClipboard(), AirPlayReceiverEngine (+4 more)

### Community 63 - "dashboard-components.tsx"
Cohesion: 0.19
Nodes (10): Input(), InputProps, AppItemProps, AppManagerPanelProps, AppInfo, AppsFilter, AppsSlice, AppsSubTab (+2 more)

### Community 64 - "ConfigView.tsx"
Cohesion: 0.06
Nodes (58): checkBin(), CLAUDE_EXE, execFileAsync, GEMINI_JS, GET(), NPM_DIR, OLLAMA_EXE, POST() (+50 more)

### Community 65 - "paths.ts"
Cohesion: 0.14
Nodes (24): Page(), QuickAction(), QuickActionProps, ThemeProps, AppsView(), ArchivosView(), ArchivosViewProps, CliInjectorView() (+16 more)

### Community 66 - "ViewShell.tsx"
Cohesion: 0.36
Nodes (7): sendTouchEvent(), WebCodecsCanvas(), WebCodecsCanvasProps, bytesEqual(), concatBytes(), startWebCodecsH264Player(), WebCodecsPlayerCallbacks

### Community 67 - "stream-diagnostic.mjs"
Cohesion: 0.33
Nodes (12): install_apk_native(), launch_avd(), launch_scrcpy_native(), list_avds(), resolve_adb_bin(), resolve_emulator_bin(), resolve_scrcpy_bin(), Option (+4 more)

### Community 68 - "route.ts"
Cohesion: 0.05
Nodes (24): captureOnce(), Ctrl, destroyIfEmpty(), EOI, FrameBroadcaster, GET(), getOrCreate(), MjpegParser (+16 more)

### Community 69 - "paths.ts"
Cohesion: 0.17
Nodes (12): Badge(), BadgeProps, BadgeSize, BadgeTone, sizeClasses, toneClasses, Card(), CardPadding (+4 more)

### Community 72 - "AirPlayReceiverEngine"
Cohesion: 0.20
Nodes (10): properties, type, default, description, type, identifier, local, remote (+2 more)

### Community 73 - "route.ts"
Cohesion: 0.18
Nodes (4): IStreamTransport, IProjectionCoordinator, ProjectionCoordinator, VisionNanoResult

### Community 74 - "route.ts"
Cohesion: 0.22
Nodes (13): GET(), getAirPlayEngine(), POST(), GET(), getAirPlay(), getIosBridge(), POST(), container (+5 more)

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
Nodes (22): AutoDetectionToast(), AutoDetectionToastProps, DeviceFrameProps, DeviceNavControls(), DeviceNavControlsProps, UseStreamTrackerProps, DeviceScreenTile, DeviceScreenTileProps (+14 more)

### Community 80 - "package.json"
Cohesion: 0.20
Nodes (10): $ref, description, items, type, uniqueItems, description, items, type (+2 more)

### Community 81 - "route.ts"
Cohesion: 0.11
Nodes (25): AppShellProps, AnimScales, AppPackage, BluetoothInfo, DeviceData, DeviceListItem, DiagnosticsData, DiagnosticsStorage (+17 more)

### Community 82 - "ArchivosView.tsx"
Cohesion: 0.17
Nodes (13): Button(), ButtonProps, ButtonSize, ButtonVariant, sizeClasses, variantClasses, CliEngineSelector(), CliEngineSelectorProps (+5 more)

### Community 83 - "samsung-watchdog.ps1"
Cohesion: 0.20
Nodes (10): type, webviews, windows, items, description, items, type, description (+2 more)

### Community 84 - "paths.ts"
Cohesion: 0.23
Nodes (9): formatBytes(), formatDate(), getErrorMessage(), AppInstallerPanel(), AppInstallerPanelProps, AppCard(), AppRow(), AppManagerPanel() (+1 more)

### Community 85 - "ios-bridge.ts"
Cohesion: 0.31
Nodes (6): RealAppIcon(), RealAppIconProps, AppsFilterDash, getAppColor(), DashboardAppsPanel(), DashboardAppsPanelProps

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
Cohesion: 0.29
Nodes (7): APP_COLORS, computeDeviceTelemetry(), DeviceTelemetrySummary, parseTempNum(), TelemetryLevel, TelemetryModal(), TelemetryModalProps

### Community 93 - "ToolsView.tsx"
Cohesion: 0.32
Nodes (4): DeviceSettingsPanel(), DeviceSettingsPanelProps, LiveAndroidSettings, ConfigViewProps

### Community 94 - "useRescueSync.ts"
Cohesion: 0.27
Nodes (8): FlashPartitionSpec, PARTITIONS, FlasherBootloaderPanel(), FlasherBootloaderPanelProps, FlasherImagePanel(), FlasherImagePanelProps, FlasherView(), FlasherViewProps

### Community 97 - "useRescueSync.ts"
Cohesion: 0.50
Nodes (4): default, description, type, description

### Community 98 - "route.ts"
Cohesion: 0.33
Nodes (4): inter, metadata, plusJakartaSans, ThemeProvider()

### Community 99 - "useRescueSync.ts"
Cohesion: 0.67
Nodes (3): PermissionEntry, anyOf, description

### Community 100 - "stream.ts"
Cohesion: 0.67
Nodes (3): Identifier, description, oneOf

### Community 101 - "desktop-schema.json"
Cohesion: 0.27
Nodes (7): DeviceInfo, IScrcpyEngine, ScrcpyEngine, ScrcpyEngineOptions, ScrcpyStreamResult, CaptureResult, IScreenCapture

### Community 102 - "adb_fast.rs"
Cohesion: 0.42
Nodes (9): adb_bin(), adb_key_fast(), adb_list_devices_fast(), FastDevice, launch_multi_scrcpy_native(), PathBuf, Result, String (+1 more)

### Community 104 - "IVisionNanoEngine"
Cohesion: 0.20
Nodes (8): ISessionManager, StreamSessionConfig, StreamSessionResult, airPlayTransport, scrcpyTransport, AirPlayServerOptions, ProjectionLaunchOptions, VisionNanoOptions

### Community 105 - "route.ts"
Cohesion: 0.67
Nodes (3): Value, anyOf, description

### Community 108 - "ISessionManager"
Cohesion: 0.32
Nodes (7): getTauri(), invokeRust(), isTauriDesktop(), NativeAppInfo, NativeDeviceMetrics, rustBridge, TauriInternals

### Community 113 - "Capability"
Cohesion: 0.50
Nodes (4): description, required, type, Capability

### Community 115 - "Identifier"
Cohesion: 0.67
Nodes (3): Identifier, description, oneOf

### Community 116 - "description"
Cohesion: 0.50
Nodes (4): default, description, type, description

### Community 120 - "Value"
Cohesion: 0.40
Nodes (4): anyOf, description, $schema, title

## Knowledge Gaps
- **416 isolated node(s):** `INSTALL-OPPO-DIRECTO.sh script`, `eslintConfig`, `nextConfig`, `name`, `version` (+411 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **19 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `DeviceInfo` connect `DeviceInfo` to `paths.ts`, `CommandResult`, `IVisionNanoEngine`, `route.ts`, `route.ts`, `route.ts`, `ArchivosView.tsx`, `detect.ts`, `paths.ts`, `route.ts`, `index.ts`, `DeviceInfoFetcher`, `DashboardView.tsx`, `index.ts`, `useRescueSync.ts`?**
  _High betweenness centrality (0.079) - this node is a cross-community bridge._
- **Why does `react` connect `Button.tsx` to `paths.ts`, `DeviceInfo`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._
- **What connects `INSTALL-OPPO-DIRECTO.sh script`, `eslintConfig`, `NOTE: This file should not be edited` to the rest of the system?**
  _428 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `types.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._
- **Should `safeExec` be split into smaller, more focused modules?**
  _Cohesion score 0.06298904538341157 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._
- **Should `config.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06685633001422475 - nodes in this community are weakly interconnected._