# AndroidProject 📱⚡

**AndroidProject** es una herramienta de ingeniería inversa y administración de dispositivos Android orientada al rendimiento. Combina el poder de **ADB (Android Debug Bridge)** y **Scrcpy** con una interfaz gráfica moderna, asíncrona y fluida construida en **Next.js** y **Electron**.

Este proyecto fue diseñado para ofrecer un control en tiempo real, latencia cero y herramientas de desarrollo sin las ataduras de la terminal de comandos tradicional.

---

## 🚀 Características Principales

*   **📺 Transmisión de Pantalla a 60 FPS**: Refleja la pantalla de tu dispositivo y contrólalo con el mouse y el teclado. Latencia mínima gracias a Scrcpy y el códec H.265.
*   **📡 Puente Wi-Fi Invisible**: ¿Cansado de los cables? AndroidProject intercepta la IP del celular e inicia una sesión inalámbrica TCP/IP estable en segundo plano para que puedas desconectar el cable y seguir trabajando a velocidad máxima.
*   **📊 Biometría en Tiempo Real**: Escaneo asíncrono profundo del hardware. Lee la temperatura de la batería, carga, uso de memoria RAM física y capacidad real del disco de almacenamiento en tiempo real directo desde los sensores nativos del teléfono.
*   **📦 Instalador de APKs por Lotes (Batch Processing)**: Arrastra y suelta múltiples archivos `.apk`. El sistema creará una fila y los instalará uno tras otro.
*   **📁 Transferencia Directa de Archivos**: Envía documentos, videos y fotos directamente a la memoria de tu teléfono (`/sdcard/Download`) soportando múltiples archivos simultáneos.
*   **🛠 Herramientas de Desarrollador**: Acceso a un clic para Modos Especiales (Bootloader, Recovery), Reinicio Normal y Apagado Forzado. Todo asegurado para prevenir conflictos de red al usar puentes Wi-Fi híbridos.

---

## 💻 Tecnologías Utilizadas

El núcleo del ecosistema está separado en tres capas potentes:
1.  **Frontend (UI)**: React, Next.js 14, Tailwind CSS, Lucide Icons. Diseñado con una filosofía Dark Mode premium, animaciones a 60hz y glassmorphism.
2.  **Motor Gráfico (Desktop)**: Electron.js, envolviendo la interfaz web en una aplicación nativa sin bordes para Windows.
3.  **Backend (API & Shell)**: Node.js orquestando subprocesos nativos de `adb` ejecutándose de forma asíncrona para prevenir bloqueos de I/O.

---

## 📸 Vistazo al Dashboard

El panel de control incluye una **Miniatura de Transmisión en Vivo** impulsada por Websockets que extrae la imagen del teléfono a 5 FPS para previsualización con botones virtuales de hardware (Volumen, Atrás, Inicio), asegurando 0 fugas de memoria GPU con su arquitectura de limpieza de Bitmaps.

---

## ⚙️ Instalación (Entorno de Desarrollo)

```bash
# 1. Clona el repositorio
git clone https://github.com/emmahiguita/AndroidProject.git
cd AndroidProject/androproject-gui

# 2. Instala las dependencias
npm install

# 3. Compila el motor interno de Next.js
npm run build

# 4. Inicia la aplicación en Windows
npx electron .
```

*Nota: Requiere tener los binarios de `scrcpy` (nombrado como AndroProject.exe) y `scrcpy-server` configurados en la raíz `C:\AndroProject\`. El binario de `adb.exe` es detectado automáticamente desde el Android SDK en `C:\Users\emman\AppData\Local\Android\Sdk\platform-tools\adb.exe`.*

---

## 🛡️ Seguridad y Arquitectura

AndroidProject fue refactorizado con una lógica de **Francotirador de IP**. Si tienes el cable USB conectado y el puente Wi-Fi activo simultáneamente, AndroidProject detecta de forma autónoma el ID primordial del dispositivo en el Daemon ADB para evitar el clásico cuelgue *"more than one device/emulator"*, estabilizando por completo todas las inyecciones de comandos shell.

---
*Desarrollado con arquitectura de vanguardia.*
