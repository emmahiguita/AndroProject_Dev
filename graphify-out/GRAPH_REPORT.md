# Graph Report - AndroProject_Dev  (2026-11-22)

## Corpus Check
- 294 files · ~573,073 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 2553 nodes · 5935 edges · 166 communities (145 shown, 21 thin omitted)
- Extraction: 90% EXTRACTED · 10% INFERRED · 0% AMBIGUOUS · INFERRED: 575 edges (avg confidence: 0.58)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `d84b70f8`
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
- desktop-schema.json
- DeviceDetector
- samsung-watchdog.ps1
- paths.ts
- Value
- scrcpy-session-hub.ts
- scrcpy-engine.ts
- scrcpy-engine.ts
- DashboardView.tsx
- useRescueSync.ts
- Value
- useRescueSync.ts
- ViewShell.tsx
- config.ts
- stream.ts
- CliInjectorView.tsx
- adb_fast.rs
- route.ts
- route.ts
- MultiScreenGrid.tsx
- WebCodecsCanvas.tsx
- route.ts
- windows-schema.json
- getLockFile
- IAdbExecutor
- isValidDeviceSerial
- ISessionManager
- paths.ts
- detectAirPlaySocketIps
- route.ts
- route.ts
- Identifier
- Value
- route.ts
- route.ts
- IProjectionCoordinator
- dashboard-components.tsx
- 🎮 Modos de Uso
- .resolve
- r
- i4
- sh
- Value
- se
- 07-hzktxqjvzd.js
- silent_cmd
- tm
- cb
- run_adb
- c
- get_or_start_session
- route.ts
- SerialQuery
- Z
- post_actions
- ThemeProvider.tsx
- a
- 0z_fixgw2teab.js
- scrcpy_api.rs
- paths.rs
- f
- i
- 3ysa49ktq69_v.js
- build_router
- 39j80ec4dl5ox.js

## God Nodes (most connected - your core abstractions)
1. `r()` - 67 edges
2. `u()` - 65 edges
3. `DeviceInfo` - 64 edges
4. `iu()` - 59 edges
5. `safeExec()` - 58 edges
6. `i()` - 37 edges
7. `a()` - 36 edges
8. `useAppStore` - 36 edges
9. `useTheme()` - 33 edges
10. `l()` - 32 edges

## Surprising Connections (you probably didn't know these)
- `POST()` --indirect_call--> `e()`  [INFERRED]
  androproject-gui/src/app/api/flash/route.ts → AndroProject_Installer/temp_build/Dashboard/www/_next/static/chunks/0cz1d0mv5g_q7.js
- `DELETE()` --indirect_call--> `e()`  [INFERRED]
  androproject-gui/src/app/api/upload-file/route.ts → AndroProject_Installer/temp_build/Dashboard/www/_next/static/chunks/0cz1d0mv5g_q7.js
- `GET()` --indirect_call--> `e()`  [INFERRED]
  androproject-gui/src/app/api/upload-file/route.ts → AndroProject_Installer/temp_build/Dashboard/www/_next/static/chunks/0cz1d0mv5g_q7.js
- `useCameraWebRtc()` --indirect_call--> `e()`  [INFERRED]
  androproject-gui/src/app/camera/useCameraWebRtc.ts → AndroProject_Installer/temp_build/Dashboard/www/_next/static/chunks/0cz1d0mv5g_q7.js
- `WebCodecsCanvas()` --indirect_call--> `e()`  [INFERRED]
  androproject-gui/src/components/projection/WebCodecsCanvas.tsx → AndroProject_Installer/temp_build/Dashboard/www/_next/static/chunks/0cz1d0mv5g_q7.js

## Import Cycles
- None detected.

## Communities (166 total, 21 thin omitted)

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
Cohesion: 0.09
Nodes (10): IosBridge, IIosBridge, IosDeviceInfo, IosWdaStatus, wdaRequest(), execAsync, listAppleUsbDevices(), listIosInstalledApps() (+2 more)

### Community 4 - "CommandResult"
Cohesion: 0.18
Nodes (22): fetchPlayStoreFallback(), GET(), INTERNAL_SYS_PREFIXES, isInternalSystemPackage(), playUrlCache, assertValidPackageName(), isValidPackageName(), CACHE_DIR (+14 more)

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
Cohesion: 0.04
Nodes (75): a0(), a1(), a2(), a3(), a4(), a5(), a6(), a7() (+67 more)

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

### Community 29 - "install-kali-desktop-auto.sh"
Cohesion: 0.06
Nodes (37): e(), eb(), ib(), nb(), ob(), rb(), sb(), t() (+29 more)

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
Cohesion: 0.21
Nodes (9): getLockFile(), ProjectionLaunchOptions, buildVisionNanoArgs(), IScrcpyEngine, ScrcpyEngineOptions, ScrcpyStreamResult, VisionNanoOptions, VisionNanoResult (+1 more)

### Community 38 - "hashcat.ps1"
Cohesion: 0.08
Nodes (38): AppShell(), AppShellProps, AutoDetectionToast(), AutoDetectionToastProps, DeviceManagerDropdown(), DeviceManagerDropdownProps, Header(), HeaderProps (+30 more)

### Community 49 - "route.ts"
Cohesion: 0.07
Nodes (59): react, Page(), MultiScreenGrid(), Badge(), BadgeProps, BadgeSize, BadgeTone, sizeClasses (+51 more)

### Community 51 - "detect.ts"
Cohesion: 0.20
Nodes (10): adb, AdbExecResult, AdbExecutor, execAsync(), execAsyncOrig, execFileAsync, DeviceInfo, ScrcpyEngine (+2 more)

### Community 53 - "AndroidProject 📱⚡"
Cohesion: 0.29
Nodes (6): AndroidProject 📱⚡, 🚀 Características Principales, ⚙️ Instalación (Entorno de Desarrollo), 🛡️ Seguridad y Arquitectura, 💻 Tecnologías Utilizadas, 📸 Vistazo al Dashboard

### Community 55 - "AndroProject - Instalador Oficial"
Cohesion: 0.33
Nodes (5): AndroProject - Instalador Oficial, Como generar el instalador, Estructura de carpetas, Que hace el instalador al ejecutarse, Requisitos del sistema

### Community 59 - "route.ts"
Cohesion: 0.18
Nodes (10): name, private, scripts, build, dev, electron, electron:build, electron:dev (+2 more)

### Community 61 - "Button.tsx"
Cohesion: 0.05
Nodes (39): dependencies, lucide-react, multicast-dns, next, react-dom, @yume-chan/adb, @yume-chan/adb-scrcpy, @yume-chan/adb-server-node-tcp (+31 more)

### Community 62 - "DeviceInfoFetcher"
Cohesion: 0.11
Nodes (20): AirPlayReceiverEngine, execAsync, detectAirPlaySocketIps(), execFileAsync, AirPlayServerOptions, buildAirPlayStandbySvg(), DEFAULT_AIRPLAY_OPTIONS, injectAirPlaySwipe() (+12 more)

### Community 63 - "dashboard-components.tsx"
Cohesion: 0.19
Nodes (12): DeviceInfoFetcher, dynamicTelemetryCache, IDeviceInfoFetcher, StaticProps, staticPropsCache, extractCpuTicks(), parseBatteryInfo(), parseCpuDelta() (+4 more)

### Community 64 - "ConfigView.tsx"
Cohesion: 0.19
Nodes (20): APKSIGNER_JAR, appendPatchLog(), cleanTempPackageFiles(), execAsyncOrig, execPatchCmd(), getErrorMessage(), KEYSTORE_FILE, LOG_FILE (+12 more)

### Community 65 - "SpywareAuditPanel.tsx"
Cohesion: 0.19
Nodes (48): a(), b(), c(), d(), E(), ea(), eb(), ec() (+40 more)

### Community 66 - "ViewShell.tsx"
Cohesion: 0.12
Nodes (31): APP_NAME_DICT, BLOAT_PREFIXES, BLOATWARE_PACKAGES, CRITICAL_SYSTEM_PACKAGES, deriveAppName(), evaluateHeuristicThreat(), getMalwareClassification(), isBloatwarePackage() (+23 more)

### Community 67 - "stream-diagnostic.mjs"
Cohesion: 0.33
Nodes (12): install_apk_native(), launch_avd(), launch_scrcpy_native(), list_avds(), resolve_adb_bin(), resolve_emulator_bin(), resolve_scrcpy_bin(), Option (+4 more)

### Community 68 - "route.ts"
Cohesion: 0.06
Nodes (38): DeviceFrame(), DeviceFrameProps, KEY_TO_ANDROID, DeviceFrameHeader(), DeviceFrameHeaderProps, fmtTime(), DeviceNavControls(), DeviceNavControlsProps (+30 more)

### Community 69 - "stream.ts"
Cohesion: 0.13
Nodes (13): GET(), getAirPlayEngine(), POST(), GET(), getAirPlay(), getIosBridge(), POST(), container (+5 more)

### Community 72 - "AirPlayReceiverEngine"
Cohesion: 0.20
Nodes (10): properties, type, default, description, type, identifier, local, remote (+2 more)

### Community 73 - "index.ts"
Cohesion: 0.10
Nodes (30): AnimScales, AppPackage, BluetoothInfo, DeviceData, DeviceListItem, DiagnosticsData, DiagnosticsStorage, GpuTweaks (+22 more)

### Community 74 - "spyware-heuristic-scanner.ts"
Cohesion: 0.22
Nodes (3): IAdbExecutor, DeviceDetector, ScreenCapture

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
Cohesion: 0.11
Nodes (28): buildDragSwipePayload(), buildWheelSwipePayload(), clamp(), clamp01(), DevicePoint, mapClientToDeviceCoords(), TouchRipple, ZoomState (+20 more)

### Community 80 - "package.json"
Cohesion: 0.20
Nodes (10): $ref, description, items, type, uniqueItems, description, items, type (+2 more)

### Community 81 - "desktop-schema.json"
Cohesion: 0.40
Nodes (4): anyOf, description, $schema, title

### Community 83 - "samsung-watchdog.ps1"
Cohesion: 0.20
Nodes (10): type, webviews, windows, items, description, items, type, description (+2 more)

### Community 84 - "paths.ts"
Cohesion: 0.17
Nodes (16): filterAndSortApps(), formatBytes(), formatDate(), getErrorMessage(), summarizeAppThreats(), AppInstallerPanel(), AppInstallerPanelProps, AppCard() (+8 more)

### Community 85 - "Value"
Cohesion: 0.14
Nodes (12): getForegroundApp(), keyevent(), adbShell(), BLOCKED_PATTERNS, inputSwipe(), inputTap(), inputText(), isIosSerial() (+4 more)

### Community 86 - "scrcpy-session-hub.ts"
Cohesion: 0.26
Nodes (12): POST(), GET(), buildTouchPacket(), classifyH264Payload(), packH264Frame(), ActiveSession, allocPort(), destroySession() (+4 more)

### Community 87 - "scrcpy-engine.ts"
Cohesion: 0.25
Nodes (8): description, properties, required, type, CapabilityRemote, urls, description, type

### Community 88 - "scrcpy-engine.ts"
Cohesion: 0.25
Nodes (8): description, properties, required, type, CapabilityRemote, urls, description, type

### Community 91 - "DashboardView.tsx"
Cohesion: 0.18
Nodes (13): RealAppIcon(), RealAppIconProps, APP_COLORS, AppsFilterDash, computeDeviceTelemetry(), DeviceTelemetrySummary, getAppColor(), parseTempNum() (+5 more)

### Community 94 - "useRescueSync.ts"
Cohesion: 0.26
Nodes (9): FlashPartitionSpec, PARTITIONS, FlasherBootloaderPanel(), FlasherBootloaderPanelProps, BOOTABLE_PARTITIONS, FlasherImagePanel(), FlasherImagePanelProps, FlasherView() (+1 more)

### Community 95 - "Value"
Cohesion: 0.28
Nodes (6): QuickAction(), QuickActionProps, ThemeProps, postActionRequest(), postPatchRequest(), projectScreensBatch()

### Community 97 - "useRescueSync.ts"
Cohesion: 0.50
Nodes (4): default, description, type, description

### Community 98 - "ViewShell.tsx"
Cohesion: 0.50
Nodes (4): default, description, type, description

### Community 99 - "config.ts"
Cohesion: 0.14
Nodes (29): activeRecordProcs, checkRecord(), execFileAsync, isIosSerial(), remuxMkvToMp4(), startRecord(), StartRecordBody, stopRecord() (+21 more)

### Community 100 - "stream.ts"
Cohesion: 0.67
Nodes (3): Identifier, description, oneOf

### Community 101 - "CliInjectorView.tsx"
Cohesion: 0.14
Nodes (12): ViewShell(), CliEngineSelector(), CliEngineSelectorProps, DiscoveryState, InjectorMode, CliResponseViewer(), CliResponseViewerProps, PRESETS (+4 more)

### Community 102 - "adb_fast.rs"
Cohesion: 0.42
Nodes (9): adb_bin(), adb_key_fast(), adb_list_devices_fast(), FastDevice, launch_multi_scrcpy_native(), PathBuf, Result, String (+1 more)

### Community 104 - "route.ts"
Cohesion: 0.31
Nodes (8): GET(), inFlightWorkers, lastGoodFrame, lastGoodFrameId, lastGoodTs, placeholderFrame(), pruneStaleCache(), triggerCapture()

### Community 105 - "route.ts"
Cohesion: 0.35
Nodes (10): CRITICAL_PARTITIONS, FLASH_DIR, isValidSerial(), POST(), VALID_PARTITIONS, execAsyncOrig, extractCmdError(), FlashInspectionResult (+2 more)

### Community 106 - "MultiScreenGrid.tsx"
Cohesion: 0.09
Nodes (40): ea(), ee(), ef(), eh(), ei(), ek(), er(), es() (+32 more)

### Community 107 - "WebCodecsCanvas.tsx"
Cohesion: 0.10
Nodes (19): Ctrl, EOI, FrameBroadcaster, MjpegParser, PART_SEP, SOI, startScreencapLoop(), tryScrcpyNamedPipePipeline() (+11 more)

### Community 115 - "route.ts"
Cohesion: 0.20
Nodes (9): 1. Vistas Reales Actualizadas (Hardware Físico), 2. Mapa de Flujo: Proyección Android 60 FPS + Multi-Pantalla, 3. Mapa de Flujo: Ecosistema iOS desde Windows, 4. Mapa de Flujo: Root, Bootloader y Seguridad de Apps (Android), 5. Grafo de Conocimiento del Repositorio, Flasheador Fastboot, Bootloader y Estado Root, Mapa de Arquitectura y Flujos — AndroProject, Multi-Pantalla en Vivo (`SM-A307G` + `CPH2557` a 60 FPS WebCodecs H.264) (+1 more)

### Community 116 - "windows-schema.json"
Cohesion: 0.40
Nodes (4): anyOf, description, $schema, title

### Community 117 - "getLockFile"
Cohesion: 0.14
Nodes (11): 1. Proyección Multi-Pantalla Concurrente (60 FPS WebCodecs H.264), 2. Panel Principal y Telemetría en Tiempo Real, 3. Gestor de Arranque, Bootloader, Particiones Fastboot y Sideload, Capturas Reales Actualizadas, Code signing policy, Demos en Video (Transmisión Móvil & Suite Dark/Light), Demos en Vivo (Reproducción Automática en GitHub), Documentación Completa (+3 more)

### Community 118 - "IAdbExecutor"
Cohesion: 0.33
Nodes (6): "Dependencias no instaladas", "Espacio insuficiente", "Kali no se inicia", "No se detectó Termux", "Sin interfaz gráfica", 🔧 Solución de Problemas

### Community 119 - "isValidDeviceSerial"
Cohesion: 0.20
Nodes (16): checkOrStopScreen(), openScreen(), checkHttpOk(), execAsync, execFileAsync, GET(), LiveAndroidSettings, POST() (+8 more)

### Community 120 - "ISessionManager"
Cohesion: 0.11
Nodes (12): createSessionId(), DeviceSession, ISessionManager, IStreamTransport, StreamSessionConfig, StreamSessionResult, AirPlayStreamTransport, airPlayTransport (+4 more)

### Community 121 - "paths.ts"
Cohesion: 0.09
Nodes (47): b(), c(), cG(), cI(), co(), cU(), d(), e1() (+39 more)

### Community 122 - "detectAirPlaySocketIps"
Cohesion: 0.50
Nodes (4): description, required, type, Capability

### Community 123 - "route.ts"
Cohesion: 0.26
Nodes (10): checkBin(), CLAUDE_EXE, execFileAsync, GEMINI_JS, GET(), isLocalReq(), NPM_DIR, OLLAMA_EXE (+2 more)

### Community 124 - "route.ts"
Cohesion: 0.09
Nodes (46): ab(), ak(), aw(), ax(), ay(), cd(), cQ(), io() (+38 more)

### Community 125 - "Identifier"
Cohesion: 0.67
Nodes (3): Identifier, description, oneOf

### Community 126 - "Value"
Cohesion: 0.43
Nodes (6): clean_safe_whitespace(), collect_paths(), list_srp_symbols(), main(), Elimina trailing spaces y >2 líneas en blanco seguidas sin alterar código., Identifica símbolos principales para guiar extracción modular SRP.

### Community 127 - "route.ts"
Cohesion: 0.46
Nodes (6): execFileAsync, getErrorMessage(), POST(), execFileAsync, extractIosUdid(), installIpaBuffer()

### Community 128 - "route.ts"
Cohesion: 0.68
Nodes (7): DELETE(), execFileAsync, GET(), getErrorMessage(), getTargetArgs(), POST(), sanitizeRemotePath()

### Community 129 - "IProjectionCoordinator"
Cohesion: 0.08
Nodes (30): A(), C(), d(), f(), i(), L(), M(), o() (+22 more)

### Community 130 - "dashboard-components.tsx"
Cohesion: 0.50
Nodes (4): 1. Interfaz Gráfica (Recomendado), 2. Línea de Comandos, 3. VNC (Conexión Remota), 🎮 Formas de Usar Kali Linux

### Community 131 - "🎮 Modos de Uso"
Cohesion: 0.50
Nodes (4): 🎮 Modos de Uso, Opción 1: Interfaz Gráfica (termux-x11) - Recomendado, Opción 2: Interfaz Gráfica (VNC), Opción 3: Línea de Comandos

### Community 132 - ".resolve"
Cohesion: 0.23
Nodes (8): execAsync, runDiagnostic(), APP_SWITCH_TAGS, LogcatEntry, parseLogcatLine(), execFileAsync, GET(), acquireSlot()

### Community 134 - "r"
Cohesion: 0.16
Nodes (37): a(), aH(), ca(), cl(), cr(), cw(), E(), eH() (+29 more)

### Community 135 - "i4"
Cohesion: 0.11
Nodes (32): cE(), cP(), cz(), e0(), i3(), i4(), ib(), ih() (+24 more)

### Community 136 - "sh"
Cohesion: 0.14
Nodes (27): ae(), al(), an(), ar(), cj(), cn(), cs(), ct() (+19 more)

### Community 137 - "Value"
Cohesion: 0.27
Nodes (13): GET(), isLocalAuthorizedRequest(), POST(), CmdOutcome, DriverScanReport, execFileAsync, installInfDriver(), isMobileUsb() (+5 more)

### Community 138 - "se"
Cohesion: 0.14
Nodes (27): e2(), eM(), eR(), fe(), fO(), fP(), fQ(), ft() (+19 more)

### Community 139 - "07-hzktxqjvzd.js"
Cohesion: 0.13
Nodes (18): g, ea(), ec(), ee(), ei(), en(), er(), et() (+10 more)

### Community 140 - "silent_cmd"
Cohesion: 0.16
Nodes (21): silent_cmd(), get_airplay(), get_drivers(), get_ios(), get_logcat(), get_security_scan(), handle_ai_cli(), post_airplay() (+13 more)

### Community 141 - "tm"
Cohesion: 0.13
Nodes (21): c2(), c5(), c6(), c7(), c8(), c9(), e4(), e6() (+13 more)

### Community 142 - "cb"
Cohesion: 0.14
Nodes (18): cb(), cH(), ck(), cV(), cx(), i7(), i9(), ia() (+10 more)

### Community 143 - "run_adb"
Cohesion: 0.22
Nodes (16): friendly_name(), get_app_icon(), post_apps(), post_install_apk(), post_upload_file(), IntoResponse, Json, StatusCode (+8 more)

### Community 145 - "get_or_start_session"
Cohesion: 0.22
Nodes (15): alloc_port(), get_or_start_session(), hub(), HashMap, Mutex, Option, Result, String (+7 more)

### Community 146 - "route.ts"
Cohesion: 0.25
Nodes (12): ExecAdbFn, extractResolvedComponent(), isPackageDisabled(), launchDevicePackage(), LaunchResult, invalidateAppListCache(), checkAdbFailure(), execAsync() (+4 more)

### Community 147 - "SerialQuery"
Cohesion: 0.24
Nodes (13): fetch_telemetry(), get_config(), get_device(), get_device_image(), list_adb_devices(), Json, Option, Query (+5 more)

### Community 148 - "Z"
Cohesion: 0.22
Nodes (14): cc(), cf(), ej(), el(), eo(), l1(), l2(), l7() (+6 more)

### Community 149 - "post_actions"
Cohesion: 0.28
Nodes (12): is_dangerous_shell(), json_ok(), post_actions(), record_pids(), HashMap, IntoResponse, Json, Mutex (+4 more)

### Community 150 - "ThemeProvider.tsx"
Cohesion: 0.26
Nodes (9): metadata, getServerTheme(), getTheme(), subscribeToTheme(), Theme, ThemeContext, ThemeContextValue, ThemeProvider() (+1 more)

### Community 151 - "a"
Cohesion: 0.20
Nodes (5): a, d(), l(), o(), x()

### Community 152 - "0z_fixgw2teab.js"
Cohesion: 0.20
Nodes (3): a(), g(), w()

### Community 153 - "scrcpy_api.rs"
Cohesion: 0.24
Nodes (9): ControlPayload, post_control(), Json, Option, Query, Response, String, Value (+1 more)

### Community 154 - "paths.rs"
Cohesion: 0.61
Nodes (8): adb_bin(), captures_dir(), fastboot_bin(), home_dir(), PathBuf, scrcpy_bin(), scrcpy_server_path(), web_root_dir()

### Community 155 - "f"
Cohesion: 0.50
Nodes (5): b(), f(), R(), v(), _()

### Community 156 - "i"
Cohesion: 0.40
Nodes (3): i, s(), u()

### Community 157 - "3ysa49ktq69_v.js"
Cohesion: 0.50
Nodes (3): a(), b(), l()

### Community 158 - "build_router"
Cohesion: 0.67
Nodes (3): build_router(), start_embedded_server(), Router

## Knowledge Gaps
- **456 isolated node(s):** `eslintConfig`, `nextConfig`, `name`, `version`, `description` (+451 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **21 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `r()` connect `r` to `safeExec`, `IProjectionCoordinator`, `i4`, `sh`, `se`, `07-hzktxqjvzd.js`, `route.ts`, `cb`, `a`, `0z_fixgw2teab.js`, `install-kali-desktop-auto.sh`, `3ysa49ktq69_v.js`, `hashcat.ps1`, `DeviceInfoFetcher`, `SpywareAuditPanel.tsx`, `DeviceInfo`, `scrcpy-session-hub.ts`, `MultiScreenGrid.tsx`, `paths.ts`, `route.ts`?**
  _High betweenness centrality (0.196) - this node is a cross-community bridge._
- **Why does `DeviceInfo` connect `route.ts` to `stream.ts`, `hashcat.ps1`, `CliInjectorView.tsx`, `types.ts`, `index.ts`, `andro.ps1`, `AppShell.tsx`, `DeviceInfo`, `route.ts`, `paths.ts`, `index.ts`, `DeviceInfoFetcher`, `DashboardView.tsx`, `ISessionManager`, `useRescueSync.ts`?**
  _High betweenness centrality (0.046) - this node is a cross-community bridge._
- **Why does `useAdbConnection()` connect `hashcat.ps1` to `route.ts`, `r`?**
  _High betweenness centrality (0.037) - this node is a cross-community bridge._
- **Are the 58 inferred relationships involving `r()` (e.g. with `diagnoseScreenshot()` and `enableWifi()`) actually correct?**
  _`r()` has 58 INFERRED edges - model-reasoned connections that need verification._
- **Are the 9 inferred relationships involving `u()` (e.g. with `a()` and `fk()`) actually correct?**
  _`u()` has 9 INFERRED edges - model-reasoned connections that need verification._
- **Are the 10 inferred relationships involving `iu()` (e.g. with `a()` and `aS()`) actually correct?**
  _`iu()` has 10 INFERRED edges - model-reasoned connections that need verification._
- **What connects `eslintConfig`, `NOTE: This file should not be edited`, `nextConfig` to the rest of the system?**
  _472 weakly-connected nodes found - possible documentation gaps or missing edges._