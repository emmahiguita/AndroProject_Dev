# Graph Report - .  (2026-08-07)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 572 nodes · 944 edges · 48 communities (31 shown, 17 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 3 edges (avg confidence: 0.7)
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

## God Nodes (most connected - your core abstractions)
1. `safeExec()` - 54 edges
2. `useAppStore` - 24 edges
3. `DeviceInfo` - 21 edges
4. `useTheme()` - 18 edges
5. `CommandResult` - 18 edges
6. `compilerOptions` - 16 edges
7. `Ensure-Connected()` - 13 edges
8. `tools` - 13 edges
9. `Show-Menu()` - 12 edges
10. `execAsync` - 11 edges

## Surprising Connections (you probably didn't know these)
- `getDiagnostics()` --calls--> `execAsync`  [EXTRACTED]
  androproject-gui/src/app/api/actions/diagnostics.ts → androproject-gui/src/app/api/actions/_lib/helpers.ts
- `getForegroundApp()` --calls--> `safeExec()`  [EXTRACTED]
  androproject-gui/src/app/api/actions/device.ts → androproject-gui/src/app/api/actions/_lib/helpers.ts
- `keyevent()` --calls--> `safeExec()`  [EXTRACTED]
  androproject-gui/src/app/api/actions/device.ts → androproject-gui/src/app/api/actions/_lib/helpers.ts
- `powerOff()` --calls--> `safeExec()`  [EXTRACTED]
  androproject-gui/src/app/api/actions/device.ts → androproject-gui/src/app/api/actions/_lib/helpers.ts
- `reboot()` --calls--> `safeExec()`  [EXTRACTED]
  androproject-gui/src/app/api/actions/device.ts → androproject-gui/src/app/api/actions/_lib/helpers.ts

## Import Cycles
- None detected.

## Communities (48 total, 17 thin omitted)

### Community 0 - "index.ts"
Cohesion: 0.05
Nodes (65): Page(), Header(), HeaderProps, ProjectionPanel(), ProjectionPanelProps, ScreenBtnProps, navItems, Sidebar() (+57 more)

### Community 1 - "safeExec"
Cohesion: 0.06
Nodes (64): getForegroundApp(), keyevent(), powerOff(), reboot(), rebootBootloader(), rebootRecovery(), restartAdb(), diagnoseScreenshot() (+56 more)

### Community 2 - "devDependencies"
Cohesion: 0.04
Nodes (48): build, appId, extraResources, files, nsis, productName, publish, win (+40 more)

### Community 3 - "config.ts"
Cohesion: 0.07
Nodes (28): execAsync, GET(), getErrorMessage(), CRITICAL_PARTITIONS, execAsync, FLASH_DIR, getCommandOutput(), getErrorMessage() (+20 more)

### Community 4 - "CommandResult"
Cohesion: 0.13
Nodes (8): AdbCommandExecutor, execAsync, MockCommandExecutor, DeviceService, NetworkService, AdbConfig, CommandResult, ICommandExecutor

### Community 5 - "types.ts"
Cohesion: 0.09
Nodes (21): SystemTerminal(), SystemTerminalProps, AnimScales, AppPackage, BluetoothInfo, DeviceData, DeviceListItem, DiagnosticsData (+13 more)

### Community 6 - "webrtc.py"
Cohesion: 0.08
Nodes (23): BaseModel, FastAPI, MediaStreamTrack, ndarray, RTCSessionDescription, offer(), OfferParameters, WebRTC offer endpoint.     Receives an SDP offer from the frontend, sets up the (+15 more)

### Community 7 - "tools"
Cohesion: 0.07
Nodes (29): agent, linux, instructions, model, permission, prompt, steps, bash (+21 more)

### Community 8 - "validation.ts"
Cohesion: 0.08
Nodes (24): actionSchemas, adguardDnsSchema, animationBatchSchema, animationScaleSchema, autoBrightnessSchema, backgroundLimitSchema, baseActionSchema, bluetoothAbsoluteVolumeSchema (+16 more)

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
Cohesion: 0.39
Nodes (8): APP_NAME_DICT, BLOATWARE_PACKAGES, deriveAppName(), execAsync, getErrorMessage(), getMalwareClassification(), isBloatwarePackage(), POST()

### Community 14 - "FeatureErrorBoundary"
Cohesion: 0.25
Nodes (3): FeatureErrorBoundary, Props, State

### Community 15 - "page.tsx"
Cohesion: 0.29
Nodes (7): CameraTransmitter(), CandidatePairStats, EncodingWithPriority, getErrorMessage(), InboundVideoStats, RuntimeWindow, TurnServer

## Knowledge Gaps
- **176 isolated node(s):** `INSTALL-OPPO-DIRECTO.sh script`, `{ app, BrowserWindow, Tray, Menu, nativeImage, shell, dialog }`, `{ spawn }`, `path`, `fs` (+171 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **17 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `DeviceInfo` connect `index.ts` to `IDeviceService`, `types.ts`?**
  _High betweenness centrality (0.018) - this node is a cross-community bridge._
- **What connects `INSTALL-OPPO-DIRECTO.sh script`, `{ app, BrowserWindow, Tray, Menu, nativeImage, shell, dialog }`, `{ spawn }` to the rest of the system?**
  _185 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `index.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.053989488772097464 - nodes in this community are weakly interconnected._
- **Should `safeExec` be split into smaller, more focused modules?**
  _Cohesion score 0.06442058496853018 - nodes in this community are weakly interconnected._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.04081632653061224 - nodes in this community are weakly interconnected._
- **Should `config.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07357357357357357 - nodes in this community are weakly interconnected._
- **Should `CommandResult` be split into smaller, more focused modules?**
  _Cohesion score 0.13063063063063063 - nodes in this community are weakly interconnected._