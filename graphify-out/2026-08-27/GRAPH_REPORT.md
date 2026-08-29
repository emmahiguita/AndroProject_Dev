# Graph Report - AndroProject_Dev  (2026-08-27)

## Corpus Check
- 135 files · ~174,566 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 901 nodes · 1493 edges · 69 communities (52 shown, 17 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 6 edges (avg confidence: 0.65)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `8f2358d0`
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
- ProjectionView.tsx
- DashboardView.tsx
- AppsView.tsx
- dashboard-components.tsx
- DeviceFrame.tsx
- DeviceInfo
- route.ts
- DeviceInfoPanel.tsx
- route.ts

## God Nodes (most connected - your core abstractions)
1. `safeExec()` - 53 edges
2. `DeviceInfo` - 32 edges
3. `useAppStore` - 24 edges
4. `useTheme()` - 20 edges
5. `compilerOptions` - 16 edges
6. `IAdbExecutor` - 15 edges
7. `useActions()` - 14 edges
8. `📱 Instrucciones de Uso - Kali Linux en Android` - 14 edges
9. `Kali Linux en Termux - Instalación Automatizada` - 14 edges
10. `Ensure-Connected()` - 13 edges

## Surprising Connections (you probably didn't know these)
- `DeviceFrameProps` --references--> `DeviceInfo`  [EXTRACTED]
  androproject-gui/src/components/layout/DeviceFrame.tsx → androproject-gui/src/features/types.ts
- `DeviceInfoPanelProps` --references--> `DeviceInfo`  [EXTRACTED]
  androproject-gui/src/components/projection/DeviceInfoPanel.tsx → androproject-gui/src/features/types.ts
- `FlasherViewProps` --references--> `DeviceInfo`  [EXTRACTED]
  androproject-gui/src/features/FlasherView.tsx → androproject-gui/src/features/types.ts
- `OptimizerViewProps` --references--> `DeviceInfo`  [EXTRACTED]
  androproject-gui/src/features/OptimizerView.tsx → androproject-gui/src/features/types.ts
- `listRunning()` --calls--> `safeExec()`  [EXTRACTED]
  androproject-gui/src/app/api/actions/apps.ts → androproject-gui/src/app/api/actions/_lib/helpers.ts

## Import Cycles
- None detected.

## Communities (69 total, 17 thin omitted)

### Community 0 - "page.tsx"
Cohesion: 0.20
Nodes (14): Page(), ViewShell(), ArchivosView(), ConfigView(), ConfigViewProps, CurarView(), FlasherView(), FlasherViewProps (+6 more)

### Community 1 - "safeExec"
Cohesion: 0.07
Nodes (55): AppInfo, getPackageInfo(), KNOWN_HIDDEN_PACKAGES, listApps(), listPackages(), listRunning(), diagnoseScreenshot(), getDiagnostics() (+47 more)

### Community 2 - "devDependencies"
Cohesion: 0.04
Nodes (48): build, appId, extraResources, files, nsis, productName, publish, win (+40 more)

### Community 3 - "config.ts"
Cohesion: 0.11
Nodes (32): checkOrStopScreen(), openScreen(), removeLocalFile(), screenshot(), startRecord(), stopRecord(), validateScreenshotFile(), execFileAsync (+24 more)

### Community 4 - "CommandResult"
Cohesion: 0.09
Nodes (11): AppPackage, QuickActionItem, AdbCommandExecutor, execAsync, MockCommandExecutor, IAdbCommandExecutor, IDeviceService, INetworkRadarService (+3 more)

### Community 5 - "types.ts"
Cohesion: 0.08
Nodes (31): inter, metadata, AppShell(), AppShellProps, Header(), HeaderProps, groups, NavItemDef (+23 more)

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
Cohesion: 0.17
Nodes (7): Get-MdnsTargets(), Get-WirelessAttachedDevices(), Invoke-Adb(), Invoke-DeviceHardening(), Start-Projection(), Test-AdbHealth(), Write-Log()

### Community 51 - "detect.ts"
Cohesion: 0.06
Nodes (25): buildOfflineDevice(), detectHardwareFallback(), detector, fetcher, GET(), selectTarget(), adb, AdbExecResult (+17 more)

### Community 52 - "debloat-driver.ps1"
Cohesion: 0.32
Nodes (3): Get-Category(), Get-PackageSnapshot(), Invoke-Adb()

### Community 53 - "AndroidProject 📱⚡"
Cohesion: 0.29
Nodes (6): AndroidProject 📱⚡, 🚀 Características Principales, ⚙️ Instalación (Entorno de Desarrollo), 🛡️ Seguridad y Arquitectura, 💻 Tecnologías Utilizadas, 📸 Vistazo al Dashboard

### Community 54 - "index.ts"
Cohesion: 0.11
Nodes (24): AnimScales, DeviceData, DeviceListItem, DiagnosticsData, GpuTweaks, AppsFilter, AppsSlice, AppsSubTab (+16 more)

### Community 55 - "AndroProject - Instalador Oficial"
Cohesion: 0.33
Nodes (5): AndroProject - Instalador Oficial, Como generar el instalador, Estructura de carpetas, Que hace el instalador al ejecutarse, Requisitos del sistema

### Community 59 - "cn"
Cohesion: 0.10
Nodes (24): Badge(), BadgeProps, BadgeSize, BadgeTone, sizeClasses, toneClasses, Button(), ButtonProps (+16 more)

### Community 60 - "ProjectionView.tsx"
Cohesion: 0.43
Nodes (7): deduplicate(), detect(), DeviceInfo, execAsync, fetchDeviceDetails(), listDevices(), ParsedDevice

### Community 61 - "DashboardView.tsx"
Cohesion: 0.16
Nodes (9): APP_COLORS, AppsFilterDash, DashboardView(), DashboardViewProps, getAppColor(), AppInfo, BluetoothInfo, DiagnosticsStorage (+1 more)

### Community 62 - "AppsView.tsx"
Cohesion: 0.25
Nodes (6): AppCard(), AppRow(), AppsView(), formatBytes(), formatDate(), getErrorMessage()

### Community 63 - "dashboard-components.tsx"
Cohesion: 0.12
Nodes (4): BLOCKED_PATTERNS, inputSwipe(), inputTap(), isValidPoint()

### Community 64 - "DeviceFrame.tsx"
Cohesion: 0.27
Nodes (9): clamp(), clamp01(), DeviceFrame(), DeviceFrameProps, TouchRipple, ZoomState, StreamMode, useDeviceStream() (+1 more)

### Community 65 - "DeviceInfo"
Cohesion: 0.20
Nodes (10): QuickAction(), QuickActionProps, ThemeProps, AppsViewProps, ArchivosViewProps, CurarViewProps, ProjectionViewProps, ToolsViewProps (+2 more)

### Community 66 - "route.ts"
Cohesion: 0.27
Nodes (10): captureFrame(), execAsync, frameCache, FrameEntry, GET(), getHealth(), healthMap, lastGoodFrame (+2 more)

### Community 67 - "DeviceInfoPanel.tsx"
Cohesion: 0.11
Nodes (15): DeviceInfoPanel(), DeviceInfoPanelProps, EmptyState(), EmptyStateProps, SplitDivider(), SplitDividerProps, ProjectionView(), useActions() (+7 more)

### Community 68 - "route.ts"
Cohesion: 0.16
Nodes (18): activeStreams, attachFrameHandler(), canRestart(), captureScreenshot(), cleanupStream(), createMjpegStream(), destroyStream(), execAsync (+10 more)

## Knowledge Gaps
- **285 isolated node(s):** `INSTALL-OPPO-DIRECTO.sh script`, `{ app, BrowserWindow, Tray, Menu, nativeImage, shell, dialog }`, `{ spawn }`, `path`, `fs` (+280 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **17 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `DeviceInfo` connect `DeviceInfo` to `page.tsx`, `DeviceFrame.tsx`, `DeviceInfoPanel.tsx`, `CommandResult`, `types.ts`, `cn`, `DashboardView.tsx`, `AppsView.tsx`?**
  _High betweenness centrality (0.015) - this node is a cross-community bridge._
- **Why does `safeExec()` connect `safeExec` to `config.ts`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **What connects `INSTALL-OPPO-DIRECTO.sh script`, `{ app, BrowserWindow, Tray, Menu, nativeImage, shell, dialog }`, `{ spawn }` to the rest of the system?**
  _297 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `safeExec` be split into smaller, more focused modules?**
  _Cohesion score 0.07192460317460317 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.04081632653061224 - nodes in this community are weakly interconnected._
- **Should `config.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.10975609756097561 - nodes in this community are weakly interconnected._
- **Should `CommandResult` be split into smaller, more focused modules?**
  _Cohesion score 0.08708708708708708 - nodes in this community are weakly interconnected._