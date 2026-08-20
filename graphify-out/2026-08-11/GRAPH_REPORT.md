# Graph Report - AndroProject_Dev  (2026-08-10)

## Corpus Check
- 129 files · ~170,290 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 823 nodes · 1349 edges · 72 communities (54 shown, 18 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.68)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `b368f364`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- index.ts
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
- page.tsx
- AppsView.tsx
- ThemeProvider.tsx
- dashboard-components.tsx
- DeviceFrame.tsx
- DeviceInfo
- route.ts
- DeviceInfoPanel.tsx
- route.ts
- useProjectionStream.ts
- ConfigView.tsx
- types.ts

## God Nodes (most connected - your core abstractions)
1. `safeExec()` - 64 edges
2. `DeviceInfo` - 32 edges
3. `useAppStore` - 25 edges
4. `useTheme()` - 22 edges
5. `compilerOptions` - 16 edges
6. `useActions()` - 15 edges
7. `📱 Instrucciones de Uso - Kali Linux en Android` - 14 edges
8. `Kali Linux en Termux - Instalación Automatizada` - 14 edges
9. `Ensure-Connected()` - 13 edges
10. `tools` - 13 edges

## Surprising Connections (you probably didn't know these)
- `DeviceFrameProps` --references--> `DeviceInfo`  [EXTRACTED]
  androproject-gui/src/components/layout/DeviceFrame.tsx → androproject-gui/src/features/types.ts
- `HeaderProps` --references--> `DeviceInfo`  [EXTRACTED]
  androproject-gui/src/components/layout/Header.tsx → androproject-gui/src/features/types.ts
- `SidebarProps` --references--> `NavSection`  [EXTRACTED]
  androproject-gui/src/components/layout/Sidebar.tsx → androproject-gui/src/features/types.ts
- `DeviceInfoPanelProps` --references--> `DeviceInfo`  [EXTRACTED]
  androproject-gui/src/components/projection/DeviceInfoPanel.tsx → androproject-gui/src/features/types.ts
- `AppsViewProps` --references--> `DeviceInfo`  [EXTRACTED]
  androproject-gui/src/features/AppsView.tsx → androproject-gui/src/features/types.ts

## Import Cycles
- None detected.

## Communities (72 total, 18 thin omitted)

### Community 0 - "index.ts"
Cohesion: 0.33
Nodes (10): Page(), ArchivosView(), AntivirusPanel(), CurarView(), ScreenshotPanel(), ToolsView(), useActions(), useDevicePolling() (+2 more)

### Community 1 - "safeExec"
Cohesion: 0.06
Nodes (68): AppInfo, getPackageInfo(), KNOWN_HIDDEN_PACKAGES, listApps(), listPackages(), listRunning(), adbShell(), BLOCKED_PATTERNS (+60 more)

### Community 2 - "devDependencies"
Cohesion: 0.04
Nodes (48): build, appId, extraResources, files, nsis, productName, publish, win (+40 more)

### Community 3 - "config.ts"
Cohesion: 0.10
Nodes (35): checkOrStopScreen(), openScreen(), removeLocalFile(), screenshot(), startRecord(), stopRecord(), validateScreenshotFile(), execAsync (+27 more)

### Community 4 - "CommandResult"
Cohesion: 0.09
Nodes (11): AppPackage, QuickActionItem, AdbCommandExecutor, execAsync, MockCommandExecutor, IAdbCommandExecutor, IDeviceService, INetworkRadarService (+3 more)

### Community 5 - "types.ts"
Cohesion: 0.13
Nodes (16): inter, metadata, AppShell(), Header(), HeaderProps, groups, NavItemDef, Sidebar() (+8 more)

### Community 6 - "webrtc.py"
Cohesion: 0.07
Nodes (29): BaseModel, FastAPI, MediaStreamTrack, ndarray, RTCSessionDescription, offer(), OfferParameters, WebRTC offer endpoint.     Receives an SDP offer from the frontend, sets up the (+21 more)

### Community 7 - "tools"
Cohesion: 0.07
Nodes (29): agent, linux, instructions, model, permission, prompt, steps, bash (+21 more)

### Community 8 - "validation.ts"
Cohesion: 0.07
Nodes (27): actionSchemas, adbShellSchema, adguardDnsSchema, animationBatchSchema, animationScaleSchema, autoBrightnessSchema, backgroundLimitSchema, baseActionSchema (+19 more)

### Community 9 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 10 - "andro.ps1"
Cohesion: 0.32
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
Cohesion: 0.33
Nodes (5): Apply-DeviceHardening(), Find-PhoneIp(), Invoke-AdbTimeout(), Test-Health(), Test-UsbSerial()

### Community 51 - "detect.ts"
Cohesion: 0.43
Nodes (7): deduplicate(), detect(), DeviceInfo, execAsync, fetchDeviceDetails(), listDevices(), ParsedDevice

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
Cohesion: 0.16
Nodes (14): Badge(), BadgeProps, BadgeSize, BadgeTone, sizeClasses, toneClasses, Card(), CardPadding (+6 more)

### Community 60 - "page.tsx"
Cohesion: 0.16
Nodes (14): Button(), ButtonProps, ButtonSize, ButtonVariant, sizeClasses, variantClasses, ViewShell(), ViewShellProps (+6 more)

### Community 61 - "AppsView.tsx"
Cohesion: 0.23
Nodes (7): AppCard(), AppRow(), AppsView(), AppsViewProps, formatBytes(), formatDate(), getErrorMessage()

### Community 62 - "ThemeProvider.tsx"
Cohesion: 0.29
Nodes (4): APP_COLORS, AppsFilterDash, DashboardView(), getAppColor()

### Community 63 - "dashboard-components.tsx"
Cohesion: 0.22
Nodes (6): InfoRowProps, QuickAction(), QuickActionProps, StateCardProps, StateTone, ThemeProps

### Community 64 - "DeviceFrame.tsx"
Cohesion: 0.24
Nodes (11): clamp(), clamp01(), DeviceFrame(), DeviceFrameProps, ZoomState, buildMjpegUrl(), ScreenshotResult, StreamMode (+3 more)

### Community 65 - "DeviceInfo"
Cohesion: 0.17
Nodes (12): DashboardViewProps, ProjectionView(), ProjectionViewProps, NavSection, useMediaQuery(), DeviceStats, INITIAL_STATS, useProjection() (+4 more)

### Community 66 - "route.ts"
Cohesion: 0.27
Nodes (10): captureFrame(), execAsync, frameCache, FrameEntry, GET(), getHealth(), healthMap, lastGoodFrame (+2 more)

### Community 67 - "DeviceInfoPanel.tsx"
Cohesion: 0.16
Nodes (7): DeviceInfoPanel(), DeviceInfoPanelProps, DeviceStats, EmptyState(), EmptyStateProps, SplitDivider(), SplitDividerProps

### Community 68 - "route.ts"
Cohesion: 0.17
Nodes (13): activeStreams, captureScreenshot(), createMjpegStream(), execAsync, FFMPEG, findScrcpy(), findScrcpyServer(), GET() (+5 more)

### Community 70 - "ConfigView.tsx"
Cohesion: 0.29
Nodes (5): SystemTerminal(), ConfigView(), ConfigViewProps, ThemeColors, useTheme()

### Community 71 - "types.ts"
Cohesion: 0.17
Nodes (13): AppShellProps, SystemTerminalProps, ArchivosViewProps, CurarViewProps, OptimizerViewProps, AppInfo, BluetoothInfo, DeviceInfo (+5 more)

## Knowledge Gaps
- **287 isolated node(s):** `INSTALL-OPPO-DIRECTO.sh script`, `{ app, BrowserWindow, Tray, Menu, nativeImage, shell, dialog }`, `{ spawn }`, `path`, `fs` (+282 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **18 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `DeviceInfo` connect `types.ts` to `index.ts`, `DeviceFrame.tsx`, `DeviceInfo`, `DeviceInfoPanel.tsx`, `CommandResult`, `types.ts`, `cn`, `page.tsx`, `AppsView.tsx`, `ThemeProvider.tsx`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Why does `safeExec()` connect `safeExec` to `config.ts`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **What connects `INSTALL-OPPO-DIRECTO.sh script`, `{ app, BrowserWindow, Tray, Menu, nativeImage, shell, dialog }`, `{ spawn }` to the rest of the system?**
  _298 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `safeExec` be split into smaller, more focused modules?**
  _Cohesion score 0.06027306027306027 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.04081632653061224 - nodes in this community are weakly interconnected._
- **Should `config.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.09696969696969697 - nodes in this community are weakly interconnected._
- **Should `CommandResult` be split into smaller, more focused modules?**
  _Cohesion score 0.08708708708708708 - nodes in this community are weakly interconnected._