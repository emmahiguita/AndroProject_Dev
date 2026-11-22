<div align="center">
  <img src="./androproject-gui/public/logo.png" alt="ANDRO-IOS Logo" width="84" />
  <h1>ANDRO-IOS</h1>
  <p><strong>Suite de Proyección 60 FPS, Multi-Pantalla Android/iOS, Telemetría en Vivo, Flasheador Fastboot y Auditoría de Apps</strong></p>

  <p>
    <a href="./docs/ARCHITECTURE_MAP.md">Mapa de Arquitectura y Funciones</a> ·
    <a href="./INSTRUCCIONES-USO.md">Guía de Uso</a> ·
    <a href="./graphify-out/GRAPH_REPORT.md">Grafo de Conocimiento</a> ·
    <a href="./AndroProject_Installer/README.md">Instalador Windows</a>
  </p>
</div>

---

## Demos en Vivo (Reproducción Automática en GitHub)

| Recorrido Completo (Modo Oscuro 2026 + Modo Claro) | Transmisión Real Móvil (`scrcpy 4.1` en Vivo) |
|---|---|
| ![Recorrido Completo Modo Oscuro y Claro](./docs/images/androproject-walkthrough.gif) | ![Grabación Real de Transmisión Móvil](./docs/images/mobile-transmission-record.gif) |
| [Descargar MP4 HD (`androproject-walkthrough.mp4`)](./docs/images/androproject-walkthrough.mp4) | [Descargar MP4 HD (`mobile-transmission-record.mp4`)](./docs/images/mobile-transmission-record.mp4) |

## Modo Oscuro 2026 vs Modo Claro

| Módulo | Modo Oscuro 2026 | Modo Claro |
|---|---|---|
| **Aplicaciones (407 apps)** | ![Apps Dark](./docs/images/apps-manager-dark.png) | ![Apps Light](./docs/images/apps-manager-light.png) |
| **Optimizador & Modo Desarrollador** | ![Optimizer Dark](./docs/images/optimizer-developer-dark.png) | ![Optimizer Light](./docs/images/optimizer-developer-light.png) |
| **Seguridad & Capturas** | ![Security Dark](./docs/images/security-audit-dark.png) | ![Security Light](./docs/images/security-audit-light.png) |
| **Herramientas & Drivers USB** | ![Tools Dark](./docs/images/tools-drivers-dark.png) | ![Tools Light](./docs/images/tools-drivers-light.png) |
| **Flasheador & Bootloader** | ![Flasher Dark](./docs/images/flasher-root-dark.png) | ![Flasher Light](./docs/images/flasher-root-light.png) |

## Capturas Reales Actualizadas

### 1. Proyección Multi-Pantalla Concurrente (60 FPS WebCodecs H.264)
Transmisión simultánea de **Samsung Galaxy A30s (`SM-A307G`)** y **OPPO A79 5G (`CPH2557`)** lado a lado con decodificación H.264 por GPU y control táctil de baja latencia (`< 2 ms`):

![Proyección Multi-Pantalla en Vivo](./docs/images/multiscreen-live.png)

### 2. Panel Principal y Telemetría en Tiempo Real
Lectura directa del kernel Android (CPU, RAM, temperatura térmica, almacenamiento libre) y acceso rápido a las 407 aplicaciones instaladas:

![Panel Principal y Telemetría](./docs/images/dashboard-telemetry.png)

### 3. Gestor de Arranque, Bootloader, Particiones Fastboot y Sideload
Inspección en vivo de estado ADB/Fastboot, Slot A/B activo, OEM Unlock, VBMeta, detección de Root (`su`/Magisk) y flasheo seguro de particiones `.img` / `.zip`:

![Flasheador y Bootloader](./docs/images/flasher-root.png)

---

## Mapa de Arquitectura y Flujos

```mermaid
flowchart LR
  ANDROID["Android USB / Wi-Fi<br/>scrcpy-server v4.1"] -->|H.264 Zero-Copy SC41| VSTREAM["/api/scrcpy-video"]
  VSTREAM -->|GPU VideoDecoder| WEBCODECS["WebCodecsCanvas (60 FPS)"]
  IPHONE["iPhone USB / AirPlay 2"] -->|pymobiledevice3 + AirPlayServer| ISTREAM["/api/device-stream"]
  WEBCODECS --> GRID["MultiScreenGrid & ProjectionCanvas"]
  ISTREAM --> GRID
  GRID -->|Tap / Swipe / APK / IPA| ACTIONS["/api/actions · /api/ios · /api/install-apk"]
  FLASH["FlasherView + /api/flash"] -->|Fastboot / ADB| BOOT["Bootloader · Slots A/B · Root Check"]
```

---

## Explicación de Funciones por Módulo

| Módulo | Qué hace | Cómo funciona | Archivo |
|---|---|---|---|
| **Hub Scrcpy 60 FPS** | Administra streams H.264 paralelos por serial | Asigna puerto/SCID único, evita opciones incompatibles con Exynos | [scrcpy-session-hub.ts](./androproject-gui/src/lib/services/scrcpy-session-hub.ts) |
| **Stream Binario Zero-Copy** | Envía frames `SC41` al navegador sin clonar buffers | `ReadableStream` con vista `Uint8Array` sobre `Buffer` y backpressure | [scrcpy-video/route.ts](./androproject-gui/src/app/api/scrcpy-video/route.ts) |
| **Player GPU WebCodecs** | Decodifica H.264 hardware a 60 FPS | Lee `avc1.PPCCLL` del SPS y dibuja en `<canvas desynchronized>` | [webcodecs-h264-player.ts](./androproject-gui/src/lib/services/webcodecs-h264-player.ts) |
| **Visor & Gestos** | Mapea taps, swipes, zoom, wheel y Drag & Drop | Separa matemática, gestos, overlays y carga APK/IPA (`< 200L`) | [ProjectionCanvas.tsx](./androproject-gui/src/components/projection/ProjectionCanvas.tsx) |
| **Multi-Pantalla** | Proyecta todos los dispositivos físicos en paralelo | Deduplica USB vs Wi-Fi y aísla cada panel con `React.memo` | [MultiScreenGrid.tsx](./androproject-gui/src/components/projection/MultiScreenGrid.tsx) |
| **Detección & Stream iOS** | Detecta iPhone USB y sirve frames AirPlay 2 | Consulta `pymobiledevice3 usbmux` + `AirPlayServer.exe` | [ios-usb-detector.ts](./androproject-gui/src/lib/services/ios-usb-detector.ts) · [ios-stream-handler.ts](./androproject-gui/src/lib/services/ios-stream-handler.ts) |
| **Build & Install `.ipa`** | Compila `.ipa` en macOS Cloud e instala por USB | Workflow `macos-latest` + `pymobiledevice3 apps install` | [ios-build.yml](./.github/workflows/ios-build.yml) · [ios-ipa-installer.ts](./androproject-gui/src/lib/services/ios-ipa-installer.ts) |
| **Flasheador & Root** | Inspecciona Bootloader, Slot A/B, OEM, `su`/Magisk y flashea | Ejecuta `adb`/`fastboot`, protege particiones críticas y bloquea seriales iOS | [FlasherView.tsx](./androproject-gui/src/features/FlasherView.tsx) · [flash-device-inspector.ts](./androproject-gui/src/lib/services/flash-device-inspector.ts) |

---

## Documentación Completa

- [Mapa Técnico Detallado](./docs/ARCHITECTURE_MAP.md)
- [Instrucciones de Uso](./INSTRUCCIONES-USO.md)
- [Integración Kali / Termux](./scripts/kali/README-KALI-TERMUX.md)
- [Instalador Oficial Windows](./AndroProject_Installer/README.md)

## Demos en Video (Transmisión Móvil & Suite Dark/Light)

- [Grabación Real de Transmisión Móvil (scrcpy 4.1)](./docs/images/mobile-transmission-record.mp4)
- [Recorrido Completo Modo Oscuro y Modo Claro](./docs/images/androproject-walkthrough.mp4)
