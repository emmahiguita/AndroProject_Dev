# Graph Report - AndroProject_Dev  (2026-11-22)

## Corpus Check
- 267 files · ~412,353 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1741 nodes · 3390 edges · 135 communities (112 shown, 23 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 13 edges (avg confidence: 0.71)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `a738282c`
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
- AppShell.tsx
- Button.tsx
- DeviceInfoFetcher
- dashboard-components.tsx
- ConfigView.tsx
- SpywareAuditPanel.tsx
- ViewShell.tsx
- stream-diagnostic.mjs
- route.ts
- stream.ts
- AirPlayReceiverEngine
- index.ts
- spyware-heuristic-scanner.ts
- build
- ProjectionCanvas.tsx
- scripts
- DeviceInfo
- DeviceInfo
- package.json
- route.ts
- DeviceDetector
- samsung-watchdog.ps1
- paths.ts
- Value
- scrcpy-session-hub.ts
- scrcpy-engine.ts
- scrcpy-engine.ts
- DashboardView.tsx
- useRescueSync.ts
- .start
- useRescueSync.ts
- ViewShell.tsx
- DeviceInfo
- stream.ts
- AirPlayReceiverEngine
- adb_fast.rs
- airplay-engine.ts
- route.ts
- IAirPlayReceiverEngine
- WebCodecsCanvas.tsx
- route.ts
- CurarView.tsx
- getLockFile
- IAdbExecutor
- paths.ts
- ISessionManager
- ThemeProvider.tsx
- detectAirPlaySocketIps
- route.ts
- ProjectionCoordinator
- Identifier
- Value
- ServiceContainer
- useSystemLogs.ts
- ISessionManager
- dashboard-components.tsx
- 🎮 Modos de Uso
- PermissionEntry
- Value

## God Nodes (most connected - your core abstractions)
1. `DeviceInfo` - 64 edges
2. `safeExec()` - 58 edges
3. `useAppStore` - 37 edges
4. `useTheme()` - 33 edges
5. `AirPlayReceiverEngine` - 27 edges
6. `isValidDeviceSerial()` - 24 edges
7. `useActions()` - 21 edges
8. `IosBridge` - 20 edges
9. `IAirPlayReceiverEngine` - 19 edges
10. `IIosBridge` - 18 edges

## Surprising Connections (you probably didn't know these)
- `AutoDetectionToastProps` --references--> `DeviceInfo`  [EXTRACTED]
  androproject-gui/src/components/layout/AutoDetectionToast.tsx → androproject-gui/src/features/types.ts
- `DeviceFrameProps` --references--> `DeviceInfo`  [EXTRACTED]
  androproject-gui/src/components/layout/DeviceFrame.tsx → androproject-gui/src/features/types.ts
- `DeviceFrameHeaderProps` --references--> `DeviceInfo`  [EXTRACTED]
  androproject-gui/src/components/layout/DeviceFrameHeader.tsx → androproject-gui/src/features/types.ts
- `MultiScreenGridProps` --references--> `DeviceInfo`  [EXTRACTED]
  androproject-gui/src/components/projection/MultiScreenGrid.tsx → androproject-gui/src/features/types.ts
- `DeviceScreenTileProps` --references--> `DeviceInfo`  [EXTRACTED]
  androproject-gui/src/components/projection/MultiScreenGrid.tsx → androproject-gui/src/features/types.ts

## Import Cycles
- None detected.

## Communities (135 total, 23 thin omitted)

### Community 0 - "types.ts"
Cohesion: 0.11
Nodes (17): app, security, windows, withGlobalTauri, build, beforeDevCommand, devUrl, frontendDist (+9 more)

### Community 1 - "safeExec"
Cohesion: 0.05
Nodes (81): listApps(), listRunning(), applyPerformanceProfile(), cleanVal(), getPerformanceStatus(), isInvalidAndroid(), openDeveloperSettings(), PerfProfileId (+73 more)

### Community 2 - "devDependencies"
Cohesion: 0.15
Nodes (13): definitions, Number, PermissionEntry, Target, Value, anyOf, description, anyOf (+5 more)

### Community 3 - "config.ts"
Cohesion: 0.08
Nodes (12): getForegroundApp(), keyevent(), IosBridge, IIosBridge, IosDeviceInfo, IosWdaStatus, wdaRequest(), execAsync (+4 more)

### Community 4 - "CommandResult"
Cohesion: 0.06
Nodes (63): execAsync, runDiagnostic(), checkBin(), CLAUDE_EXE, execFileAsync, GEMINI_JS, GET(), isLocalReq() (+55 more)

### Community 5 - "types.ts"
Cohesion: 0.19
Nodes (14): detector, fetcher, GET(), NO_CACHE, selectTarget(), DetectedDevice, serialNoCache, buildOfflineDevice() (+6 more)

### Community 6 - "webrtc.py"
Cohesion: 0.06
Nodes (35): BaseModel, FastAPI, MediaStreamTrack, ndarray, RTCConfiguration, RTCSessionDescription, offer(), OfferParameters (+27 more)

### Community 7 - "tools"
Cohesion: 0.07
Nodes (29): agent, linux, instructions, model, permission, prompt, steps, bash (+21 more)

### Community 8 - "validation.ts"
Cohesion: 0.06
Nodes (35): actionSchemas, adbShellSchema, adguardDnsSchema, animationBatchSchema, animationScaleSchema, autoBrightnessSchema, backgroundLimitSchema, baseActionSchema (+27 more)

### Community 9 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 10 - "andro.ps1"
Cohesion: 0.16
Nodes (18): IOSMirrorPage(), AirPlayStudioCard(), AirPlayStudioCardProps, DeviceInfoPanelProps, ToggleRow(), ToolButton(), formatTime(), ProjectionToolsCard() (+10 more)

### Community 11 - "main.js"
Cohesion: 0.15
Nodes (13): definitions, Number, PermissionEntry, Target, Value, anyOf, description, anyOf (+5 more)

### Community 12 - "route.ts"
Cohesion: 0.26
Nodes (19): activeRecordProcs, checkRecord(), execFileAsync, isIosSerial(), remuxMkvToMp4(), startRecord(), StartRecordBody, stopRecord() (+11 more)

### Community 13 - "route.ts"
Cohesion: 0.16
Nodes (24): adb_bin(), is_valid_package(), is_valid_serial(), NativeAppInfo, parse_pkg_set(), PathBuf, Result, String (+16 more)

### Community 14 - "FeatureErrorBoundary"
Cohesion: 0.25
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
Cohesion: 0.14
Nodes (30): APP_SWITCH_TAGS, LogcatEntry, parseLogcatLine(), execFileAsync, LogcatConsoleView(), LogcatConsoleViewProps, LogcatCrashVault(), LogcatCrashVaultProps (+22 more)

### Community 26 - "auto-install-kali-complete.sh"
Cohesion: 0.17
Nodes (10): Get-DeviceWifiIp(), Get-MdnsTargets(), Get-WirelessAttachedDevices(), Invoke-Adb(), Invoke-DeviceHardening(), Start-Projection(), Stop-ScrcpyIfRunning(), Test-AdbHealth() (+2 more)

### Community 27 - "check-mobile.sh"
Cohesion: 0.13
Nodes (14): 1. Conectar tu Oppo a la misma red WiFi, 2. Abrir Termux en tu Oppo, 3. Dar permisos de almacenamiento, 4. Descargar el script de instalación, 5. Dar permisos de ejecución, 6. Ejecutar la instalación, 📦 Archivos Disponibles para Descargar:, 🚀 Después de la Instalación: (+6 more)

### Community 28 - "create-shortcuts.sh"
Cohesion: 0.15
Nodes (13): Acceso Directo Manual, 🔄 Actualización, ⌨️ Comandos Rápidos (Aliases), 🤝 Contribuciones, 📱 Crear Accesos Directos en Android, Kali Linux en Termux - Instalación Automatizada, ⚖️ Licencia, ⚠️ Notas Importantes (+5 more)

### Community 29 - "install-kali-desktop-auto.sh"
Cohesion: 0.12
Nodes (25): react, Page(), MultiScreenGrid(), QuickAction(), QuickActionProps, ThemeProps, ViewShell(), ArchivosView() (+17 more)

### Community 30 - "INSTALL-OPPO-DIRECTO.sh"
Cohesion: 0.32
Nodes (3): Get-Category(), Get-PackageSnapshot(), Invoke-Adb()

### Community 31 - "setup-vnc-password.sh"
Cohesion: 0.39
Nodes (6): Get-OnlineDevices(), Get-WifiIp(), Invoke-Adb(), Invoke-Hardening(), Start-RescueScrcpy(), Stop-Scrcpy()

### Community 32 - "start-desktop.sh"
Cohesion: 0.40
Nodes (5): El script no se ejecuta, Error de conexión VNC, Espacio insuficiente, La interfaz gráfica no inicia, 🔧 Solución de Problemas

### Community 34 - "transfer-to-phone.sh"
Cohesion: 0.50
Nodes (4): description, required, type, Capability

### Community 36 - "connect_phone.ps1"
Cohesion: 0.50
Nodes (4): 🚀 Instalación Rápida, Paso 1: Dar permisos de almacenamiento a Termux, Paso 2: Copiar el script de instalación, Paso 3: Ejecutar el script de instalación

### Community 37 - "create_shortcut.ps1"
Cohesion: 0.13
Nodes (10): getLockFile(), ProjectionLaunchOptions, buildVisionNanoArgs(), IScrcpyEngine, IVisionNanoEngine, ScrcpyEngineOptions, ScrcpyStreamResult, VisionNanoOptions (+2 more)

### Community 38 - "hashcat.ps1"
Cohesion: 0.19
Nodes (17): DeviceManagerDropdown(), DeviceManagerDropdownProps, HeaderProps, AdbDevice, AdbStatusResponse, loadRegisteredDevices(), postAdbAction(), RegisteredDevice (+9 more)

### Community 49 - "route.ts"
Cohesion: 0.10
Nodes (29): Button(), ButtonProps, ButtonSize, ButtonVariant, sizeClasses, variantClasses, Card(), CardPadding (+21 more)

### Community 51 - "detect.ts"
Cohesion: 0.23
Nodes (8): adb, AdbExecResult, AdbExecutor, execAsync(), execAsyncOrig, ScrcpyEngine, CaptureResult, IScreenCapture

### Community 53 - "AndroidProject 📱⚡"
Cohesion: 0.29
Nodes (6): AndroidProject 📱⚡, 🚀 Características Principales, ⚙️ Instalación (Entorno de Desarrollo), 🛡️ Seguridad y Arquitectura, 💻 Tecnologías Utilizadas, 📸 Vistazo al Dashboard

### Community 54 - "index.ts"
Cohesion: 0.29
Nodes (7): CliEngineSelector(), CliEngineSelectorProps, DiscoveryState, InjectorMode, CliResponseViewer(), CliResponseViewerProps, PRESETS

### Community 55 - "AndroProject - Instalador Oficial"
Cohesion: 0.33
Nodes (5): AndroProject - Instalador Oficial, Como generar el instalador, Estructura de carpetas, Que hace el instalador al ejecutarse, Requisitos del sistema

### Community 59 - "route.ts"
Cohesion: 0.18
Nodes (10): name, private, scripts, build, dev, electron, electron:build, electron:dev (+2 more)

### Community 60 - "AppShell.tsx"
Cohesion: 0.15
Nodes (16): AppShell(), AutoDetectionToast(), AutoDetectionToastProps, Header(), groups, NavItemDef, Sidebar(), SidebarProps (+8 more)

### Community 61 - "Button.tsx"
Cohesion: 0.05
Nodes (39): dependencies, lucide-react, multicast-dns, next, react-dom, @yume-chan/adb, @yume-chan/adb-scrcpy, @yume-chan/adb-server-node-tcp (+31 more)

### Community 63 - "dashboard-components.tsx"
Cohesion: 0.17
Nodes (13): DeviceInfo, DeviceInfoFetcher, dynamicTelemetryCache, IDeviceInfoFetcher, StaticProps, staticPropsCache, extractCpuTicks(), parseBatteryInfo() (+5 more)

### Community 64 - "ConfigView.tsx"
Cohesion: 0.19
Nodes (20): APKSIGNER_JAR, appendPatchLog(), cleanTempPackageFiles(), execAsyncOrig, execPatchCmd(), getErrorMessage(), KEYSTORE_FILE, LOG_FILE (+12 more)

### Community 65 - "SpywareAuditPanel.tsx"
Cohesion: 0.16
Nodes (14): Badge(), BadgeProps, BadgeSize, BadgeTone, sizeClasses, toneClasses, Input(), InputProps (+6 more)

### Community 66 - "ViewShell.tsx"
Cohesion: 0.10
Nodes (38): APP_NAME_DICT, BLOAT_PREFIXES, BLOATWARE_PACKAGES, CRITICAL_SYSTEM_PACKAGES, deriveAppName(), evaluateHeuristicThreat(), getMalwareClassification(), isBloatwarePackage() (+30 more)

### Community 67 - "stream-diagnostic.mjs"
Cohesion: 0.33
Nodes (12): install_apk_native(), launch_avd(), launch_scrcpy_native(), list_avds(), resolve_adb_bin(), resolve_emulator_bin(), resolve_scrcpy_bin(), Option (+4 more)

### Community 68 - "route.ts"
Cohesion: 0.09
Nodes (24): DeviceFrame(), DeviceFrameProps, KEY_TO_ANDROID, DeviceFrameHeader(), DeviceFrameHeaderProps, fmtTime(), DeviceNavControls(), DeviceNavControlsProps (+16 more)

### Community 69 - "stream.ts"
Cohesion: 0.18
Nodes (11): GET(), getAirPlayEngine(), POST(), GET(), getAirPlay(), getIosBridge(), POST(), container (+3 more)

### Community 72 - "AirPlayReceiverEngine"
Cohesion: 0.20
Nodes (10): properties, type, default, description, type, identifier, local, remote (+2 more)

### Community 73 - "index.ts"
Cohesion: 0.19
Nodes (13): AppsFilter, AppsSlice, AppsSubTab, AppsViewMode, createAppsSlice(), createFlasherSlice(), FlasherSlice, AppStore (+5 more)

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
Cohesion: 0.29
Nodes (9): ensure_platform_services(), is_port_open(), main(), open_device_popout(), resolve_project_root(), PathBuf, Result, String (+1 more)

### Community 79 - "DeviceInfo"
Cohesion: 0.12
Nodes (27): buildDragSwipePayload(), buildWheelSwipePayload(), clamp(), clamp01(), DevicePoint, mapClientToDeviceCoords(), TouchRipple, ZoomState (+19 more)

### Community 80 - "package.json"
Cohesion: 0.20
Nodes (10): $ref, description, items, type, uniqueItems, description, items, type (+2 more)

### Community 81 - "route.ts"
Cohesion: 0.18
Nodes (15): AnimScales, AppPackage, BluetoothInfo, DeviceData, DeviceListItem, DiagnosticsData, DiagnosticsStorage, GpuTweaks (+7 more)

### Community 83 - "samsung-watchdog.ps1"
Cohesion: 0.20
Nodes (10): type, webviews, windows, items, description, items, type, description (+2 more)

### Community 84 - "paths.ts"
Cohesion: 0.18
Nodes (15): filterAndSortApps(), formatBytes(), formatDate(), getErrorMessage(), summarizeAppThreats(), AppInstallerPanel(), AppInstallerPanelProps, AppCard() (+7 more)

### Community 85 - "Value"
Cohesion: 0.16
Nodes (10): adbShell(), BLOCKED_PATTERNS, inputSwipe(), inputTap(), inputText(), isIosSerial(), isValidPoint(), pasteClipboard() (+2 more)

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
Cohesion: 0.17
Nodes (14): RealAppIcon(), RealAppIconProps, APP_COLORS, AppsFilterDash, computeDeviceTelemetry(), DeviceTelemetrySummary, getAppColor(), parseTempNum() (+6 more)

### Community 94 - "useRescueSync.ts"
Cohesion: 0.27
Nodes (8): FlashPartitionSpec, PARTITIONS, FlasherBootloaderPanel(), FlasherBootloaderPanelProps, BOOTABLE_PARTITIONS, FlasherImagePanel(), FlasherImagePanelProps, FlasherViewProps

### Community 95 - ".start"
Cohesion: 0.28
Nodes (9): captureAirPlayWindowPng(), ensureBonjourDaemon(), execAsync, findRunningAirPlayPid(), focusAirPlayWindow(), getLocalIpAndMac(), resolveAirPlayDir(), spawnAirPlayProcess() (+1 more)

### Community 97 - "useRescueSync.ts"
Cohesion: 0.50
Nodes (4): default, description, type, description

### Community 98 - "ViewShell.tsx"
Cohesion: 0.50
Nodes (4): default, description, type, description

### Community 99 - "DeviceInfo"
Cohesion: 0.21
Nodes (10): DeviceScreenTile, DeviceScreenTileProps, MultiScreenGridProps, getTauri(), invokeRust(), isTauriDesktop(), NativeAppInfo, NativeDeviceMetrics (+2 more)

### Community 100 - "stream.ts"
Cohesion: 0.67
Nodes (3): Identifier, description, oneOf

### Community 102 - "adb_fast.rs"
Cohesion: 0.42
Nodes (9): adb_bin(), adb_key_fast(), adb_list_devices_fast(), FastDevice, launch_multi_scrcpy_native(), PathBuf, Result, String (+1 more)

### Community 104 - "airplay-engine.ts"
Cohesion: 0.29
Nodes (10): execAsync, detectAirPlaySocketIps(), execAsync, AirPlayServerOptions, buildAirPlayStandbySvg(), DEFAULT_AIRPLAY_OPTIONS, injectAirPlaySwipe(), injectAirPlayTap() (+2 more)

### Community 105 - "route.ts"
Cohesion: 0.35
Nodes (10): CRITICAL_PARTITIONS, FLASH_DIR, isValidSerial(), POST(), VALID_PARTITIONS, execAsyncOrig, extractCmdError(), FlashInspectionResult (+2 more)

### Community 106 - "IAirPlayReceiverEngine"
Cohesion: 0.40
Nodes (4): anyOf, description, $schema, title

### Community 107 - "WebCodecsCanvas.tsx"
Cohesion: 0.10
Nodes (19): Ctrl, EOI, FrameBroadcaster, MjpegParser, PART_SEP, SOI, startScreencapLoop(), tryScrcpyNamedPipePipeline() (+11 more)

### Community 115 - "route.ts"
Cohesion: 0.20
Nodes (9): 1. Vistas Reales Actualizadas (Hardware Físico), 2. Mapa de Flujo: Proyección Android 60 FPS + Multi-Pantalla, 3. Mapa de Flujo: Ecosistema iOS desde Windows, 4. Mapa de Flujo: Root, Bootloader y Seguridad de Apps (Android), 5. Grafo de Conocimiento del Repositorio, Flasheador Fastboot, Bootloader y Estado Root, Mapa de Arquitectura y Flujos — AndroProject, Multi-Pantalla en Vivo (`SM-A307G` + `CPH2557` a 60 FPS WebCodecs H.264) (+1 more)

### Community 116 - "CurarView.tsx"
Cohesion: 0.35
Nodes (8): ScreenshotDiagResult, ScreenshotPanel(), AntivirusPanel(), CurarViewProps, postActionRequest(), postPatchRequest(), projectScreensBatch(), useActions()

### Community 117 - "getLockFile"
Cohesion: 0.14
Nodes (11): 1. Proyección Multi-Pantalla Concurrente (60 FPS WebCodecs H.264), 2. Panel Principal y Telemetría en Tiempo Real, 3. Gestor de Arranque, Bootloader, Particiones Fastboot y Sideload, Capturas Reales Actualizadas, Code signing policy, Demos en Video (Transmisión Móvil & Suite Dark/Light), Demos en Vivo (Reproducción Automática en GitHub), Documentación Completa (+3 more)

### Community 118 - "IAdbExecutor"
Cohesion: 0.33
Nodes (6): "Dependencias no instaladas", "Espacio insuficiente", "Kali no se inicia", "No se detectó Termux", "Sin interfaz gráfica", 🔧 Solución de Problemas

### Community 119 - "paths.ts"
Cohesion: 0.20
Nodes (10): discoverAndroprojectBin(), discoverScrcpyServer(), findWingetScrcpy(), ADB_BUNDLED, ADB_SDK, ADB_SDK_ALT, DEBUG_LOG, FASTBOOT_BUNDLED (+2 more)

### Community 120 - "ISessionManager"
Cohesion: 0.19
Nodes (10): createSessionId(), DeviceSession, IStreamTransport, StreamSessionConfig, StreamSessionResult, AirPlayStreamTransport, airPlayTransport, ScrcpyStreamTransport (+2 more)

### Community 121 - "ThemeProvider.tsx"
Cohesion: 0.22
Nodes (7): inter, metadata, plusJakartaSans, Theme, ThemeContext, ThemeContextValue, ThemeProvider()

### Community 122 - "detectAirPlaySocketIps"
Cohesion: 0.50
Nodes (4): description, required, type, Capability

### Community 123 - "route.ts"
Cohesion: 0.31
Nodes (8): GET(), inFlightWorkers, lastGoodFrame, lastGoodFrameId, lastGoodTs, placeholderFrame(), pruneStaleCache(), triggerCapture()

### Community 125 - "Identifier"
Cohesion: 0.67
Nodes (3): Identifier, description, oneOf

### Community 126 - "Value"
Cohesion: 0.43
Nodes (6): clean_safe_whitespace(), collect_paths(), list_srp_symbols(), main(), Elimina trailing spaces y >2 líneas en blanco seguidas sin alterar código., Identifica símbolos principales para guiar extracción modular SRP.

### Community 128 - "useSystemLogs.ts"
Cohesion: 0.38
Nodes (6): AppShellProps, SystemLogs, createSystemLogEntry(), SystemLogType, useSystemLogs(), UseSystemLogsResult

### Community 130 - "dashboard-components.tsx"
Cohesion: 0.50
Nodes (4): 1. Interfaz Gráfica (Recomendado), 2. Línea de Comandos, 3. VNC (Conexión Remota), 🎮 Formas de Usar Kali Linux

### Community 131 - "🎮 Modos de Uso"
Cohesion: 0.50
Nodes (4): 🎮 Modos de Uso, Opción 1: Interfaz Gráfica (termux-x11) - Recomendado, Opción 2: Interfaz Gráfica (VNC), Opción 3: Línea de Comandos

### Community 132 - "PermissionEntry"
Cohesion: 0.40
Nodes (4): anyOf, description, $schema, title

### Community 137 - "Value"
Cohesion: 0.27
Nodes (13): GET(), isLocalAuthorizedRequest(), POST(), CmdOutcome, DriverScanReport, execFileAsync, installInfDriver(), isMobileUsb() (+5 more)

## Knowledge Gaps
- **458 isolated node(s):** `eslintConfig`, `nextConfig`, `name`, `version`, `description` (+453 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **23 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `DeviceInfo` connect `route.ts` to `useSystemLogs.ts`, `types.ts`, `andro.ps1`, `install-kali-desktop-auto.sh`, `hashcat.ps1`, `index.ts`, `AppShell.tsx`, `DeviceInfoFetcher`, `route.ts`, `stream.ts`, `DeviceInfo`, `route.ts`, `paths.ts`, `DashboardView.tsx`, `useRescueSync.ts`, `DeviceInfo`, `AirPlayReceiverEngine`, `airplay-engine.ts`, `CurarView.tsx`, `ISessionManager`, `ProjectionCoordinator`?**
  _High betweenness centrality (0.088) - this node is a cross-community bridge._
- **Why does `react` connect `install-kali-desktop-auto.sh` to `Button.tsx`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **Why does `dependencies` connect `Button.tsx` to `install-kali-desktop-auto.sh`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **What connects `eslintConfig`, `NOTE: This file should not be edited`, `nextConfig` to the rest of the system?**
  _474 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `types.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._
- **Should `safeExec` be split into smaller, more focused modules?**
  _Cohesion score 0.05195968645016797 - nodes in this community are weakly interconnected._
- **Should `config.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08115942028985507 - nodes in this community are weakly interconnected._