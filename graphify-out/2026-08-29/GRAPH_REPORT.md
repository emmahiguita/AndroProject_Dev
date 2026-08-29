# Graph Report - AndroProject_Dev  (2026-08-29)

## Corpus Check
- 161 files · ~260,210 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1054 nodes · 1738 edges · 99 communities (77 shown, 22 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 7 edges (avg confidence: 0.63)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `303b75ee`
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
- page.tsx
- route.ts
- route.ts
- build
- ProjectionCanvas.tsx
- scripts
- DeviceInfo
- AppsView.tsx
- package.json
- route.ts
- launch_airplay.js
- test_airplay_run.js
- projection-coordinator.ts
- run_uxplay_standalone.js
- test_uxplay_live.js
- debug_uxplay.js
- stress_test_airplay.js
- DashboardView.tsx
- detect.ts
- apps.ts
- diagnostics.ts
- ConfigView.tsx

## God Nodes (most connected - your core abstractions)
1. `safeExec()` - 51 edges
2. `DeviceInfo` - 43 edges
3. `useAppStore` - 24 edges
4. `useTheme()` - 20 edges
5. `AirPlayReceiverEngine` - 18 edges
6. `MjpegFrameHandler` - 17 edges
7. `compilerOptions` - 16 edges
8. `useActions()` - 15 edges
9. `📱 Instrucciones de Uso - Kali Linux en Android` - 14 edges
10. `Kali Linux en Termux - Instalación Automatizada` - 14 edges

## Surprising Connections (you probably didn't know these)
- `Page()` --references--> `react`  [EXTRACTED]
  androproject-gui/src/app/page.tsx → androproject-gui/package.json
- `listRunning()` --calls--> `safeExec()`  [EXTRACTED]
  androproject-gui/src/app/api/actions/apps.ts → androproject-gui/src/app/api/actions/_lib/helpers.ts
- `diagnoseScreenshot()` --calls--> `safeExec()`  [EXTRACTED]
  androproject-gui/src/app/api/actions/diagnostics.ts → androproject-gui/src/app/api/actions/_lib/helpers.ts
- `getOptimizerSettings()` --calls--> `safeExec()`  [EXTRACTED]
  androproject-gui/src/app/api/actions/diagnostics.ts → androproject-gui/src/app/api/actions/_lib/helpers.ts
- `runTrim()` --calls--> `safeExec()`  [EXTRACTED]
  androproject-gui/src/app/api/actions/diagnostics.ts → androproject-gui/src/app/api/actions/_lib/helpers.ts

## Import Cycles
- None detected.

## Communities (99 total, 22 thin omitted)

### Community 0 - "types.ts"
Cohesion: 0.18
Nodes (14): AppPackage, BluetoothInfo, DeviceData, DeviceListItem, DiagnosticsStorage, OptimizerSettings, QuickActionItem, SystemLogs (+6 more)

### Community 1 - "safeExec"
Cohesion: 0.16
Nodes (22): getAnimationScale(), getDpi(), ScaleMap, setAnimationBatch(), setAnimationScale(), setAutoBrightness(), setDemoMode(), setDpi() (+14 more)

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
Cohesion: 0.11
Nodes (17): ADB, { app, BrowserWindow, Tray, Menu, nativeImage, shell, dialog, desktopCapturer, session }, createIOSMirrorWindow(), createTray(), createWindow(), findIOSFeed(), fs, getAirPlayServerPath() (+9 more)

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
Cohesion: 0.07
Nodes (29): DeviceFrame(), DeviceFrameProps, DeviceInfoPanel(), DeviceInfoPanelProps, EmptyState(), EmptyStateProps, clamp(), clamp01() (+21 more)

### Community 52 - "debloat-driver.ps1"
Cohesion: 0.32
Nodes (3): Get-Category(), Get-PackageSnapshot(), Invoke-Adb()

### Community 53 - "AndroidProject 📱⚡"
Cohesion: 0.29
Nodes (6): AndroidProject 📱⚡, 🚀 Características Principales, ⚙️ Instalación (Entorno de Desarrollo), 🛡️ Seguridad y Arquitectura, 💻 Tecnologías Utilizadas, 📸 Vistazo al Dashboard

### Community 54 - "index.ts"
Cohesion: 0.05
Nodes (41): inter, metadata, plusJakartaSans, AppShell(), AppShellProps, Header(), HeaderProps, groups (+33 more)

### Community 55 - "AndroProject - Instalador Oficial"
Cohesion: 0.33
Nodes (5): AndroProject - Instalador Oficial, Como generar el instalador, Estructura de carpetas, Que hace el instalador al ejecutarse, Requisitos del sistema

### Community 59 - "route.ts"
Cohesion: 0.21
Nodes (11): fastbootErase(), fastbootReboot(), fastbootRebootRecovery(), ActionContext, buildContext(), validateAction(), ActionHandler, connectAdb() (+3 more)

### Community 60 - "index.ts"
Cohesion: 0.20
Nodes (11): getErrorMessage(), dnsTunnelSetup(), dnsTunnelStart(), dnsTunnelStatus(), dnsTunnelStop(), enableWifi(), radar(), setAdguardDns() (+3 more)

### Community 61 - "Button.tsx"
Cohesion: 0.15
Nodes (13): dependencies, electron-updater, lucide-react, multicast-dns, next, react, react-dom, @yume-chan/adb (+5 more)

### Community 63 - "dashboard-components.tsx"
Cohesion: 0.12
Nodes (4): BLOCKED_PATTERNS, inputSwipe(), inputTap(), isValidPoint()

### Community 66 - "ViewShell.tsx"
Cohesion: 0.16
Nodes (14): Badge(), BadgeProps, BadgeSize, BadgeTone, sizeClasses, toneClasses, Card(), CardPadding (+6 more)

### Community 68 - "route.ts"
Cohesion: 0.07
Nodes (17): captureScreenshot(), createMjpegStream(), execAsync, FFMPEG_PATH, GET(), placeholderFrame(), SCRCPY_PATH, BinaryCache (+9 more)

### Community 69 - "paths.ts"
Cohesion: 0.15
Nodes (10): ANDROPROJECT_BIN, discoverAndroprojectBin(), findWingetScrcpy(), ADB_BUNDLED, ADB_SDK, ADB_SDK_ALT, DEBUG_LOG, FASTBOOT_BUNDLED (+2 more)

### Community 72 - "page.tsx"
Cohesion: 0.27
Nodes (15): Page(), AppsView(), ArchivosView(), ConfigView(), AntivirusPanel(), CurarView(), ScreenshotPanel(), DashboardView() (+7 more)

### Community 73 - "route.ts"
Cohesion: 0.83
Nodes (3): execFileAsync, getErrorMessage(), POST()

### Community 74 - "route.ts"
Cohesion: 0.83
Nodes (3): execFileAsync, getErrorMessage(), POST()

### Community 75 - "build"
Cohesion: 0.17
Nodes (12): build, appId, extraResources, files, nsis, productName, publish, win (+4 more)

### Community 76 - "ProjectionCanvas.tsx"
Cohesion: 0.24
Nodes (6): checkOrStopScreen(), AirPlayServerOptions, DEFAULT_AIRPLAY_OPTIONS, getLocalIpAndMac(), ProjectionLaunchOptions, VisionNanoOptions

### Community 77 - "scripts"
Cohesion: 0.22
Nodes (9): scripts, build, build:win, dev, electron, electron:fresh, lint, start (+1 more)

### Community 78 - "DeviceInfo"
Cohesion: 0.24
Nodes (6): ViewShellProps, APP_COLORS, AppsFilterDash, DashboardViewProps, getAppColor(), NavSection

### Community 79 - "AppsView.tsx"
Cohesion: 0.24
Nodes (6): AppCard(), AppRow(), AppsViewProps, formatBytes(), formatDate(), getErrorMessage()

### Community 80 - "package.json"
Cohesion: 0.33
Nodes (5): description, main, name, private, version

### Community 81 - "route.ts"
Cohesion: 0.13
Nodes (21): AnimScales, AppInfo, DiagnosticsData, GpuTweaks, AppsFilter, AppsSlice, AppsSubTab, AppsViewMode (+13 more)

### Community 82 - "launch_airplay.js"
Cohesion: 0.33
Nodes (5): airplayDir, airplayExe, p, path, { spawn }

### Community 83 - "test_airplay_run.js"
Cohesion: 0.33
Nodes (5): airplayDir, airplayExe, p, path, { spawn }

### Community 84 - "projection-coordinator.ts"
Cohesion: 0.21
Nodes (3): IScrcpyEngine, IVisionNanoEngine, VisionNanoEngine

### Community 85 - "run_uxplay_standalone.js"
Cohesion: 0.25
Nodes (7): airplayDir, args, child, env, path, { spawn }, uxplayExe

### Community 86 - "test_uxplay_live.js"
Cohesion: 0.25
Nodes (7): airplayDir, args, env, p, path, { spawn }, uxplayExe

### Community 87 - "debug_uxplay.js"
Cohesion: 0.29
Nodes (6): airplayDir, env, p, path, { spawn }, uxplayExe

### Community 88 - "stress_test_airplay.js"
Cohesion: 0.22
Nodes (8): airplayDir, args, env, fs, p, path, { spawn }, uxplayExe

### Community 89 - "DashboardView.tsx"
Cohesion: 0.17
Nodes (11): Button(), ButtonProps, ButtonSize, ButtonVariant, sizeClasses, variantClasses, QuickAction(), QuickActionProps (+3 more)

### Community 91 - "detect.ts"
Cohesion: 0.43
Nodes (7): deduplicate(), detect(), DeviceInfo, execAsync, fetchDeviceDetails(), listDevices(), ParsedDevice

### Community 92 - "apps.ts"
Cohesion: 0.43
Nodes (6): AppInfo, getPackageInfo(), KNOWN_HIDDEN_PACKAGES, listApps(), listPackages(), listRunning()

### Community 93 - "diagnostics.ts"
Cohesion: 0.38
Nodes (5): diagnoseScreenshot(), getDiagnostics(), getOptimizerSettings(), runTrim(), execAsync

## Knowledge Gaps
- **335 isolated node(s):** `INSTALL-OPPO-DIRECTO.sh script`, `{ app, BrowserWindow, Tray, Menu, nativeImage, shell, dialog, desktopCapturer, session }`, `{ spawn }`, `path`, `fs` (+330 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **22 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `DeviceInfo` connect `index.ts` to `types.ts`, `paths.ts`, `ViewShell.tsx`, `page.tsx`, `ProjectionCanvas.tsx`, `DeviceInfo`, `AppsView.tsx`, `detect.ts`, `DashboardView.tsx`, `DeviceInfoFetcher`?**
  _High betweenness centrality (0.123) - this node is a cross-community bridge._
- **Why does `Page()` connect `page.tsx` to `types.ts`, `Button.tsx`, `index.ts`?**
  _High betweenness centrality (0.068) - this node is a cross-community bridge._
- **Why does `dependencies` connect `Button.tsx` to `package.json`?**
  _High betweenness centrality (0.068) - this node is a cross-community bridge._
- **What connects `INSTALL-OPPO-DIRECTO.sh script`, `{ app, BrowserWindow, Tray, Menu, nativeImage, shell, dialog, desktopCapturer, session }`, `{ spawn }` to the rest of the system?**
  _347 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._
- **Should `CommandResult` be split into smaller, more focused modules?**
  _Cohesion score 0.1282051282051282 - nodes in this community are weakly interconnected._
- **Should `types.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0574400723654455 - nodes in this community are weakly interconnected._