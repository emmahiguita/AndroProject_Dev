# Graph Report - AndroProject_Dev  (2026-08-29)

## Corpus Check
- 148 files · ~254,781 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 990 nodes · 1675 edges · 86 communities (65 shown, 21 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 6 edges (avg confidence: 0.65)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `720c0adc`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- page.tsx
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
- cn
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
- route.ts
- route.ts
- route.ts
- build
- types.ts
- scripts
- airplay-engine.ts
- ArchivosView.tsx
- package.json
- DeviceInfo
- DashboardView.tsx
- AppsView.tsx
- useSystemLogs.ts
- dashboard-components.tsx

## God Nodes (most connected - your core abstractions)
1. `safeExec()` - 51 edges
2. `DeviceInfo` - 42 edges
3. `useAppStore` - 24 edges
4. `useTheme()` - 20 edges
5. `AirPlayReceiverEngine` - 17 edges
6. `MjpegFrameHandler` - 17 edges
7. `compilerOptions` - 16 edges
8. `useActions()` - 15 edges
9. `📱 Instrucciones de Uso - Kali Linux en Android` - 14 edges
10. `Kali Linux en Termux - Instalación Automatizada` - 14 edges

## Surprising Connections (you probably didn't know these)
- `DeviceFrameProps` --references--> `DeviceInfo`  [EXTRACTED]
  androproject-gui/src/components/layout/DeviceFrame.tsx → androproject-gui/src/features/types.ts
- `SidebarProps` --references--> `NavSection`  [EXTRACTED]
  androproject-gui/src/components/layout/Sidebar.tsx → androproject-gui/src/features/types.ts
- `ProjectionCanvasProps` --references--> `DeviceInfo`  [EXTRACTED]
  androproject-gui/src/components/projection/ProjectionCanvas.tsx → androproject-gui/src/features/types.ts
- `ArchivosViewProps` --references--> `DeviceInfo`  [EXTRACTED]
  androproject-gui/src/features/ArchivosView.tsx → androproject-gui/src/features/types.ts
- `FlasherViewProps` --references--> `DeviceInfo`  [EXTRACTED]
  androproject-gui/src/features/FlasherView.tsx → androproject-gui/src/features/types.ts

## Import Cycles
- None detected.

## Communities (86 total, 21 thin omitted)

### Community 0 - "page.tsx"
Cohesion: 0.43
Nodes (7): deduplicate(), detect(), DeviceInfo, execAsync, fetchDeviceDetails(), listDevices(), ParsedDevice

### Community 1 - "safeExec"
Cohesion: 0.07
Nodes (55): AppInfo, getPackageInfo(), KNOWN_HIDDEN_PACKAGES, listApps(), listPackages(), listRunning(), diagnoseScreenshot(), getDiagnostics() (+47 more)

### Community 2 - "devDependencies"
Cohesion: 0.13
Nodes (15): devDependencies, autoprefixer, concurrently, cross-env, electron, electron-builder, eslint, eslint-config-next (+7 more)

### Community 3 - "config.ts"
Cohesion: 0.39
Nodes (10): startRecord(), stopRecord(), cleanupOrphanedLocks(), deleteLock(), execAsync, getRecordLockFile(), isLockAlive(), killLockedProcess() (+2 more)

### Community 4 - "CommandResult"
Cohesion: 0.13
Nodes (8): AdbCommandExecutor, execAsync, MockCommandExecutor, IAdbCommandExecutor, INetworkRadarService, AdbConfig, CommandResult, ICommandExecutor

### Community 5 - "types.ts"
Cohesion: 0.06
Nodes (33): GET(), inFlightWorkers, lastGoodFrame, lastGoodFrameId, lastGoodTs, placeholderFrame(), triggerCapture(), buildOfflineDevice() (+25 more)

### Community 6 - "webrtc.py"
Cohesion: 0.07
Nodes (29): BaseModel, FastAPI, MediaStreamTrack, ndarray, RTCSessionDescription, offer(), OfferParameters, WebRTC offer endpoint.     Receives an SDP offer from the frontend, sets up the (+21 more)

### Community 7 - "tools"
Cohesion: 0.07
Nodes (29): agent, linux, instructions, model, permission, prompt, steps, bash (+21 more)

### Community 8 - "validation.ts"
Cohesion: 0.07
Nodes (28): actionSchemas, adbShellSchema, adguardDnsSchema, animationBatchSchema, animationScaleSchema, autoBrightnessSchema, backgroundLimitSchema, baseActionSchema (+20 more)

### Community 9 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 10 - "andro.ps1"
Cohesion: 0.29
Nodes (18): adb(), adb-sh(), Connect-Phone(), Ensure-Connected(), Enter-MSF(), Enter-Shell(), Invoke-Tool(), Open-VNC() (+10 more)

### Community 11 - "main.js"
Cohesion: 0.13
Nodes (10): ADB, { app, BrowserWindow, Tray, Menu, nativeImage, shell, dialog }, createTray(), createWindow(), fs, getAssetPath(), http, path (+2 more)

### Community 12 - "route.ts"
Cohesion: 0.17
Nodes (15): APKSIGNER_JAR, appendLog(), execAsync, getErrorMessage(), isValidPackageName(), isValidSerial(), KEYSTORE_FILE, LOG_FILE (+7 more)

### Community 13 - "route.ts"
Cohesion: 0.29
Nodes (12): APP_NAME_DICT, BLOATWARE_PACKAGES, CRITICAL_SYSTEM_PACKAGES, deriveAppName(), execAsync, getErrorMessage(), getMalwareClassification(), isBloatwarePackage() (+4 more)

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

### Community 48 - "📱 Instrucciones para Descargar e Instalar en Oppo"
Cohesion: 0.13
Nodes (14): 1. Conectar tu Oppo a la misma red WiFi, 2. Abrir Termux en tu Oppo, 3. Dar permisos de almacenamiento, 4. Descargar el script de instalación, 5. Dar permisos de ejecución, 6. Ejecutar la instalación, 📦 Archivos Disponibles para Descargar:, 🚀 Después de la Instalación: (+6 more)

### Community 49 - "route.ts"
Cohesion: 0.39
Nodes (8): CRITICAL_PARTITIONS, execAsync, FLASH_DIR, getCommandOutput(), getErrorMessage(), isValidSerial(), POST(), VALID_PARTITIONS

### Community 50 - "samsung-watchdog.ps1"
Cohesion: 0.18
Nodes (8): Get-MdnsTargets(), Get-WirelessAttachedDevices(), Invoke-Adb(), Invoke-DeviceHardening(), Start-Projection(), Stop-ScrcpyIfRunning(), Test-AdbHealth(), Write-Log()

### Community 51 - "detect.ts"
Cohesion: 0.18
Nodes (14): AppInfo, AppsFilter, AppsSlice, AppsSubTab, AppsViewMode, createAppsSlice(), createFlasherSlice(), FlasherSlice (+6 more)

### Community 52 - "debloat-driver.ps1"
Cohesion: 0.32
Nodes (3): Get-Category(), Get-PackageSnapshot(), Invoke-Adb()

### Community 53 - "AndroidProject 📱⚡"
Cohesion: 0.29
Nodes (6): AndroidProject 📱⚡, 🚀 Características Principales, ⚙️ Instalación (Entorno de Desarrollo), 🛡️ Seguridad y Arquitectura, 💻 Tecnologías Utilizadas, 📸 Vistazo al Dashboard

### Community 54 - "index.ts"
Cohesion: 0.09
Nodes (30): inter, metadata, plusJakartaSans, AppShell(), Header(), HeaderProps, groups, NavItemDef (+22 more)

### Community 55 - "AndroProject - Instalador Oficial"
Cohesion: 0.33
Nodes (5): AndroProject - Instalador Oficial, Como generar el instalador, Estructura de carpetas, Que hace el instalador al ejecutarse, Requisitos del sistema

### Community 59 - "cn"
Cohesion: 0.07
Nodes (29): DeviceFrame(), DeviceFrameProps, DeviceInfoPanel(), DeviceInfoPanelProps, EmptyState(), EmptyStateProps, clamp(), clamp01() (+21 more)

### Community 60 - "index.ts"
Cohesion: 0.21
Nodes (3): IScrcpyEngine, IVisionNanoEngine, VisionNanoEngine

### Community 61 - "Button.tsx"
Cohesion: 0.17
Nodes (12): dependencies, electron-updater, lucide-react, next, react, react-dom, @yume-chan/adb, @yume-chan/adb-scrcpy (+4 more)

### Community 63 - "dashboard-components.tsx"
Cohesion: 0.12
Nodes (4): BLOCKED_PATTERNS, inputSwipe(), inputTap(), isValidPoint()

### Community 66 - "ViewShell.tsx"
Cohesion: 0.24
Nodes (17): Page(), AppsView(), ArchivosView(), ConfigView(), AntivirusPanel(), CurarView(), ScreenshotPanel(), DashboardView() (+9 more)

### Community 68 - "route.ts"
Cohesion: 0.07
Nodes (17): captureScreenshot(), createMjpegStream(), execAsync, FFMPEG_PATH, GET(), placeholderFrame(), SCRCPY_PATH, BinaryCache (+9 more)

### Community 69 - "paths.ts"
Cohesion: 0.15
Nodes (10): ANDROPROJECT_BIN, discoverAndroprojectBin(), findWingetScrcpy(), ADB_BUNDLED, ADB_SDK, ADB_SDK_ALT, DEBUG_LOG, FASTBOOT_BUNDLED (+2 more)

### Community 72 - "route.ts"
Cohesion: 0.13
Nodes (16): Badge(), BadgeProps, BadgeSize, BadgeTone, sizeClasses, toneClasses, Button(), ButtonProps (+8 more)

### Community 73 - "route.ts"
Cohesion: 0.83
Nodes (3): execFileAsync, getErrorMessage(), POST()

### Community 74 - "route.ts"
Cohesion: 0.83
Nodes (3): execFileAsync, getErrorMessage(), POST()

### Community 75 - "build"
Cohesion: 0.17
Nodes (12): build, appId, extraResources, files, nsis, productName, publish, win (+4 more)

### Community 76 - "types.ts"
Cohesion: 0.16
Nodes (16): AnimScales, AppPackage, BluetoothInfo, DeviceData, DeviceListItem, DiagnosticsData, DiagnosticsStorage, GpuTweaks (+8 more)

### Community 77 - "scripts"
Cohesion: 0.22
Nodes (9): scripts, build, build:win, dev, electron, electron:fresh, lint, start (+1 more)

### Community 78 - "airplay-engine.ts"
Cohesion: 0.17
Nodes (7): checkOrStopScreen(), AirPlayServerOptions, DEFAULT_AIRPLAY_OPTIONS, ProjectionCoordinator, ProjectionLaunchOptions, VisionNanoOptions, VisionNanoResult

### Community 79 - "ArchivosView.tsx"
Cohesion: 0.18
Nodes (9): Card(), CardPadding, CardProps, paddingClasses, ViewShell(), ArchivosViewProps, ConfigViewProps, OptimizerView() (+1 more)

### Community 80 - "package.json"
Cohesion: 0.33
Nodes (5): description, main, name, private, version

### Community 81 - "DeviceInfo"
Cohesion: 0.18
Nodes (6): AppsViewProps, CurarViewProps, ToolsViewProps, DeviceInfo, UseDevicePollingResult, IDeviceService

### Community 82 - "DashboardView.tsx"
Cohesion: 0.24
Nodes (6): ViewShellProps, APP_COLORS, AppsFilterDash, DashboardViewProps, getAppColor(), NavSection

### Community 83 - "AppsView.tsx"
Cohesion: 0.27
Nodes (5): AppCard(), AppRow(), formatBytes(), formatDate(), getErrorMessage()

### Community 84 - "useSystemLogs.ts"
Cohesion: 0.38
Nodes (6): AppShellProps, SystemLogs, createSystemLogEntry(), SystemLogType, useSystemLogs(), UseSystemLogsResult

### Community 85 - "dashboard-components.tsx"
Cohesion: 0.50
Nodes (3): QuickAction(), QuickActionProps, ThemeProps

## Knowledge Gaps
- **297 isolated node(s):** `INSTALL-OPPO-DIRECTO.sh script`, `{ app, BrowserWindow, Tray, Menu, nativeImage, shell, dialog }`, `{ spawn }`, `path`, `fs` (+292 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **21 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `DeviceInfo` connect `DeviceInfo` to `paths.ts`, `ViewShell.tsx`, `types.ts`, `airplay-engine.ts`, `ArchivosView.tsx`, `DashboardView.tsx`, `AppsView.tsx`, `useSystemLogs.ts`, `index.ts`, `cn`, `DeviceInfoFetcher`?**
  _High betweenness centrality (0.101) - this node is a cross-community bridge._
- **What connects `INSTALL-OPPO-DIRECTO.sh script`, `{ app, BrowserWindow, Tray, Menu, nativeImage, shell, dialog }`, `{ spawn }` to the rest of the system?**
  _309 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `safeExec` be split into smaller, more focused modules?**
  _Cohesion score 0.07192460317460317 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._
- **Should `CommandResult` be split into smaller, more focused modules?**
  _Cohesion score 0.1282051282051282 - nodes in this community are weakly interconnected._
- **Should `types.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0574400723654455 - nodes in this community are weakly interconnected._
- **Should `webrtc.py` be split into smaller, more focused modules?**
  _Cohesion score 0.06827880512091039 - nodes in this community are weakly interconnected._