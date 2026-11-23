# Graph Report - AndroProject_Dev  (2026-11-22)

## Corpus Check
- 198 files · ~374,172 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1181 nodes · 2117 edges · 111 communities (94 shown, 17 thin omitted)
- Extraction: 97% EXTRACTED · 3% INFERRED · 0% AMBIGUOUS · INFERRED: 56 edges (avg confidence: 0.77)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `5cb7c54b`
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
- Button.tsx
- stream-diagnostic.mjs
- route.ts
- AirPlayReceiverEngine
- index.ts
- build
- ProjectionCanvas.tsx
- scripts
- DeviceInfo
- DeviceInfo
- package.json
- samsung-watchdog.ps1
- paths.ts
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
- 🎮 Modos de Uso
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
6. `post_actions()` - 17 edges
7. `NavSection` - 16 edges
8. `compilerOptions` - 16 edges
9. `useCameraWebRtc()` - 14 edges
10. `📱 Instrucciones de Uso - Kali Linux en Android` - 14 edges

## Surprising Connections (you probably didn't know these)
- `get_or_start_session()` --calls--> `adb_bin()`  [INFERRED]
  androproject-gui/src-tauri/src/server/scrcpy_hub.rs → androproject-gui/src-tauri/src/server/paths.rs
- `get_or_start_session()` --calls--> `scrcpy_server_path()`  [INFERRED]
  androproject-gui/src-tauri/src/server/scrcpy_hub.rs → androproject-gui/src-tauri/src/server/paths.rs
- `get_or_start_session()` --calls--> `silent_cmd()`  [INFERRED]
  androproject-gui/src-tauri/src/server/scrcpy_hub.rs → androproject-gui/src-tauri/src/server/paths.rs
- `get_or_start_session()` --calls--> `run_adb()`  [INFERRED]
  androproject-gui/src-tauri/src/server/scrcpy_hub.rs → androproject-gui/src-tauri/src/server/paths.rs
- `AutoDetectionToastProps` --references--> `DeviceInfo`  [EXTRACTED]
  androproject-gui/src/components/layout/AutoDetectionToast.tsx → androproject-gui/src/features/types.ts

## Import Cycles
- None detected.

## Communities (111 total, 17 thin omitted)

### Community 0 - "types.ts"
Cohesion: 0.11
Nodes (17): app, security, windows, withGlobalTauri, build, beforeDevCommand, devUrl, frontendDist (+9 more)

### Community 1 - "safeExec"
Cohesion: 0.15
Nodes (13): DeviceScreenTile, DeviceScreenTileProps, MultiScreenGridProps, ZoomState, ProjectionCanvasProps, UseProjectionGesturesParams, AppsViewProps, CurarViewProps (+5 more)

### Community 2 - "devDependencies"
Cohesion: 0.13
Nodes (14): anyOf, definitions, Number, Target, Value, description, anyOf, description (+6 more)

### Community 3 - "config.ts"
Cohesion: 0.27
Nodes (7): DeviceFrameProps, KEY_TO_ANDROID, DeviceFrameHeader(), DeviceFrameHeaderProps, fmtTime(), DeviceNavControls(), DeviceNavControlsProps

### Community 4 - "CommandResult"
Cohesion: 0.33
Nodes (8): sendTouchEvent(), WebCodecsCanvas(), WebCodecsCanvasProps, bytesEqual(), concatBytes(), extractAvcCodec(), startWebCodecsH264Player(), WebCodecsPlayerCallbacks

### Community 5 - "types.ts"
Cohesion: 0.29
Nodes (7): APP_COLORS, computeDeviceTelemetry(), DeviceTelemetrySummary, parseTempNum(), TelemetryLevel, TelemetryModal(), TelemetryModalProps

### Community 6 - "webrtc.py"
Cohesion: 0.06
Nodes (35): BaseModel, FastAPI, MediaStreamTrack, ndarray, RTCConfiguration, RTCSessionDescription, offer(), OfferParameters (+27 more)

### Community 7 - "tools"
Cohesion: 0.07
Nodes (29): agent, linux, instructions, model, permission, prompt, steps, bash (+21 more)

### Community 8 - "validation.ts"
Cohesion: 0.64
Nodes (7): buildDragSwipePayload(), buildWheelSwipePayload(), clamp(), clamp01(), DevicePoint, mapClientToDeviceCoords(), useProjectionGestures()

### Community 9 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 10 - "andro.ps1"
Cohesion: 0.14
Nodes (20): IOSMirrorPage(), AirPlayStudioCard(), AirPlayStudioCardProps, DeviceInfoPanel(), DeviceInfoPanelProps, ToggleRow(), ToolButton(), formatTime() (+12 more)

### Community 11 - "main.js"
Cohesion: 0.15
Nodes (13): definitions, Number, PermissionEntry, Target, Value, anyOf, description, anyOf (+5 more)

### Community 12 - "route.ts"
Cohesion: 0.32
Nodes (4): DeviceSettingsPanel(), DeviceSettingsPanelProps, LiveAndroidSettings, ConfigViewProps

### Community 13 - "route.ts"
Cohesion: 0.16
Nodes (26): adb_bin(), has_adb_error(), is_valid_package(), is_valid_serial(), launch_package_native(), NativeAppInfo, parse_pkg_set(), PathBuf (+18 more)

### Community 14 - "FeatureErrorBoundary"
Cohesion: 0.25
Nodes (3): FeatureErrorBoundary, Props, State

### Community 15 - "page.tsx"
Cohesion: 0.13
Nodes (28): CameraRefsBundle, captureVideoSnapshot(), disposeCameraResources(), listVideoInputs(), requestCameraStream(), startWebmRecording(), CameraActivityLogs(), CameraMetricsGrid() (+20 more)

### Community 17 - "IDeviceService"
Cohesion: 0.07
Nodes (27): 1. Interfaz Gráfica (Recomendado), 2. Línea de Comandos, 3. VNC (Conexión Remota), 🔄 Actualización, ⌨️ Comandos Rápidos, 📱 Crear Accesos Directos en Android, "Dependencias no instaladas", En tu dispositivo Android: (+19 more)

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
Cohesion: 0.20
Nodes (10): 🔄 Actualización, ⌨️ Comandos Rápidos (Aliases), 🤝 Contribuciones, Kali Linux en Termux - Instalación Automatizada, ⚖️ Licencia, ⚠️ Notas Importantes, 📚 Recursos Adicionales, 📋 Requisitos Previos (+2 more)

### Community 29 - "install-kali-desktop-auto.sh"
Cohesion: 0.32
Nodes (7): getTauri(), invokeRust(), isTauriDesktop(), NativeAppInfo, NativeDeviceMetrics, rustBridge, TauriInternals

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
Cohesion: 0.50
Nodes (4): 1. Proyección Multi-Pantalla Concurrente (60 FPS WebCodecs H.264), 2. Panel Principal y Telemetría en Tiempo Real, 3. Gestor de Arranque, Bootloader, Particiones Fastboot y Sideload, Capturas Reales Actualizadas

### Community 38 - "hashcat.ps1"
Cohesion: 0.06
Nodes (45): metadata, AppShell(), AppShellProps, AutoDetectionToast(), AutoDetectionToastProps, DeviceManagerDropdown(), DeviceManagerDropdownProps, Header() (+37 more)

### Community 49 - "route.ts"
Cohesion: 0.12
Nodes (22): Badge(), BadgeProps, BadgeSize, BadgeTone, sizeClasses, toneClasses, Card(), CardPadding (+14 more)

### Community 51 - "detect.ts"
Cohesion: 0.67
Nodes (3): PermissionEntry, anyOf, description

### Community 53 - "AndroidProject 📱⚡"
Cohesion: 0.29
Nodes (6): AndroidProject 📱⚡, 🚀 Características Principales, ⚙️ Instalación (Entorno de Desarrollo), 🛡️ Seguridad y Arquitectura, 💻 Tecnologías Utilizadas, 📸 Vistazo al Dashboard

### Community 54 - "index.ts"
Cohesion: 0.67
Nodes (3): Acceso Directo Manual, 📱 Crear Accesos Directos en Android, Usando Termux:Widgets (Recomendado)

### Community 55 - "AndroProject - Instalador Oficial"
Cohesion: 0.33
Nodes (5): AndroProject - Instalador Oficial, Como generar el instalador, Estructura de carpetas, Que hace el instalador al ejecutarse, Requisitos del sistema

### Community 59 - "route.ts"
Cohesion: 0.18
Nodes (10): name, private, scripts, build, dev, electron, electron:build, electron:dev (+2 more)

### Community 61 - "Button.tsx"
Cohesion: 0.05
Nodes (39): dependencies, lucide-react, multicast-dns, next, react-dom, @yume-chan/adb, @yume-chan/adb-scrcpy, @yume-chan/adb-server-node-tcp (+31 more)

### Community 67 - "stream-diagnostic.mjs"
Cohesion: 0.33
Nodes (12): install_apk_native(), launch_avd(), launch_scrcpy_native(), list_avds(), resolve_adb_bin(), resolve_emulator_bin(), resolve_scrcpy_bin(), Option (+4 more)

### Community 68 - "route.ts"
Cohesion: 0.13
Nodes (15): DeviceFrame(), EmptyState(), EmptyStateProps, MobileProjection(), MobileProjectionProps, fmtTime(), ProjectionToolbar(), ProjectionToolbarProps (+7 more)

### Community 72 - "AirPlayReceiverEngine"
Cohesion: 0.20
Nodes (10): properties, type, default, description, type, identifier, local, remote (+2 more)

### Community 73 - "index.ts"
Cohesion: 0.10
Nodes (28): OptimizerNetworkAudioPanelProps, AnimScales, AppPackage, BluetoothInfo, DeviceData, DeviceListItem, DiagnosticsData, DiagnosticsStorage (+20 more)

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
Cohesion: 0.28
Nodes (9): TouchRipple, ProjectionCanvas(), ProjectionOverlays(), ProjectionOverlaysProps, DropStatus, useProjectionDrop(), StreamMode, useDeviceStream() (+1 more)

### Community 80 - "package.json"
Cohesion: 0.20
Nodes (10): $ref, description, items, type, uniqueItems, description, items, type (+2 more)

### Community 83 - "samsung-watchdog.ps1"
Cohesion: 0.20
Nodes (10): type, webviews, windows, items, description, items, type, description (+2 more)

### Community 84 - "paths.ts"
Cohesion: 0.18
Nodes (15): filterAndSortApps(), formatBytes(), formatDate(), getErrorMessage(), summarizeAppThreats(), AppInstallerPanel(), AppInstallerPanelProps, AppCard() (+7 more)

### Community 87 - "scrcpy-engine.ts"
Cohesion: 0.25
Nodes (8): description, properties, required, type, CapabilityRemote, urls, description, type

### Community 88 - "scrcpy-engine.ts"
Cohesion: 0.25
Nodes (8): description, properties, required, type, CapabilityRemote, urls, description, type

### Community 91 - "DashboardView.tsx"
Cohesion: 0.13
Nodes (16): RealAppIcon(), RealAppIconProps, ViewShell(), ViewShellProps, DEST_FOLDERS, AppsFilterDash, getAppColor(), DashboardAppsPanel() (+8 more)

### Community 94 - "useRescueSync.ts"
Cohesion: 0.43
Nodes (5): FlashPartitionSpec, PARTITIONS, BOOTABLE_PARTITIONS, FlasherImagePanel(), FlasherImagePanelProps

### Community 95 - "Value"
Cohesion: 0.14
Nodes (27): react, Page(), MultiScreenGrid(), QuickAction(), QuickActionProps, ThemeProps, ArchivosView(), CliInjectorView() (+19 more)

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
Cohesion: 0.09
Nodes (23): Button(), ButtonProps, ButtonSize, ButtonVariant, sizeClasses, variantClasses, DeviceFileBrowser(), DeviceFileBrowserProps (+15 more)

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
Nodes (7): Code signing policy, Demos en Video (Transmisión Móvil & Suite Dark/Light), Demos en Vivo (Reproducción Automática en GitHub), Documentación Completa, Explicación de Funciones por Módulo, Mapa de Arquitectura y Flujos, Modo Oscuro 2026 vs Modo Claro

### Community 122 - "detectAirPlaySocketIps"
Cohesion: 0.50
Nodes (4): description, required, type, Capability

### Community 125 - "Identifier"
Cohesion: 0.67
Nodes (3): Identifier, description, oneOf

### Community 126 - "Value"
Cohesion: 0.43
Nodes (6): clean_safe_whitespace(), collect_paths(), list_srp_symbols(), main(), Elimina trailing spaces y >2 líneas en blanco seguidas sin alterar código., Identifica símbolos principales para guiar extracción modular SRP.

### Community 131 - "🎮 Modos de Uso"
Cohesion: 0.50
Nodes (4): 🎮 Modos de Uso, Opción 1: Interfaz Gráfica (termux-x11) - Recomendado, Opción 2: Interfaz Gráfica (VNC), Opción 3: Línea de Comandos

### Community 140 - "silent_cmd"
Cohesion: 0.05
Nodes (83): is_dangerous_shell(), json_ok(), post_actions(), record_pids(), HashMap, IntoResponse, Json, Mutex (+75 more)

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

- **Why does `DeviceInfo` connect `safeExec` to `config.ts`, `route.ts`, `CliInjectorView.tsx`, `hashcat.ps1`, `types.ts`, `index.ts`, `andro.ps1`, `DeviceInfo`, `route.ts`, `paths.ts`, `DashboardView.tsx`, `Value`?**
  _High betweenness centrality (0.031) - this node is a cross-community bridge._
- **Why does `react` connect `Value` to `Button.tsx`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Why does `dependencies` connect `Button.tsx` to `Value`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **What connects `eslintConfig`, `NOTE: This file should not be edited`, `nextConfig` to the rest of the system?**
  _366 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `types.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._
- **Should `safeExec` be split into smaller, more focused modules?**
  _Cohesion score 0.14705882352941177 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.13333333333333333 - nodes in this community are weakly interconnected._