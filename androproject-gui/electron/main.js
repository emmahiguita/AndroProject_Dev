const { app, BrowserWindow, Tray, Menu, nativeImage, shell, dialog } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const http = require('http');
let autoUpdater;

// Verificar que estamos en Electron
if (!app) {
  console.error('Este script debe ejecutarse con Electron, no con Node.js directamente');
  process.exit(1);
}

let gotTheLock;

// Cargar auto-updater (puede fallar en dev)
try { autoUpdater = require('electron-updater').autoUpdater; } catch { console.log('[Init] autoUpdater no disponible en modo dev'); }

// ── Single instance lock ───────────────────────────────────────────────
gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) { app.quit(); return; }

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});

let mainWindow;
let tray;
let serverProcess;
let isQuitting = false;

const PORT = parseInt(process.env.NEXTJS_PORT || process.env.PORT || '3001', 10);
const SERVER_URL = `http://127.0.0.1:${PORT}`;

function getAssetPath(relativePath) {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'next-standalone', 'public', relativePath);
  } else {
    return path.join(__dirname, '..', 'public', relativePath);
  }
}

// ── Detección de ADB ───────────────────────────────────────────────────
function getAdbPath() {
  if (process.env.ANDROPROJECT_ADB_PATH && fs.existsSync(process.env.ANDROPROJECT_ADB_PATH)) return process.env.ANDROPROJECT_ADB_PATH;
  const home = process.env.ANDROPROJECT_HOME || 'C:\\AndroProject';
  const bundled = path.join(home, 'adb.exe');
  if (fs.existsSync(bundled)) return bundled;
  const localAppData = process.env.LOCALAPPDATA || '';
  const sdk = path.join(localAppData, 'Android', 'Sdk', 'platform-tools', 'adb.exe');
  if (fs.existsSync(sdk)) return sdk;
  return 'adb';
}
const ADB = getAdbPath();

// ── System Tray ────────────────────────────────────────────────────────
function createTray() {
  const iconPath = getAssetPath('icon.png');
  let trayIcon;
  try {
    trayIcon = nativeImage.createFromPath(iconPath);
    if (trayIcon.isEmpty()) throw new Error('empty');
    trayIcon = trayIcon.resize({ width: 16, height: 16 });
  } catch {
    // Crear icono mínimo si el png falla
    trayIcon = nativeImage.createEmpty();
  }

  tray = new Tray(trayIcon);
  tray.setToolTip('AndroProject v2.1.0');

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Mostrar AndroProject', click: () => { mainWindow.show(); mainWindow.focus(); } },
    { label: 'Ocultar a bandeja', click: () => { mainWindow.hide(); } },
    { type: 'separator' },
    // El "Dashboard" es la UI de la app de escritorio (Next.js dentro de Electron).
    // En vez de abrir una URL hardcoded en un navegador (y con puerto erróneo 3000),
    // mostramos/enfocamos la ventana principal. Si por algún motivo no existe
    // todavía, abrimos SERVER_URL en el navegador como fallback.
    { label: 'Dashboard', click: () => {
        if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
        else {
          // En entorno de desarrollo abrimos el navegador como fallback para facilitar pruebas.
          // En producción (app empaquetada) preferimos no abrir el navegador.
          if (!app.isPackaged) { shell.openExternal(SERVER_URL); }
        }
      } },
    { type: 'separator' },
    { label: 'Salir', click: () => { isQuitting = true; app.quit(); } },
  ]);

  tray.setContextMenu(contextMenu);

  tray.on('click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// ── Auto-Updater ───────────────────────────────────────────────────────
function setupAutoUpdater() {
  if (!autoUpdater) return;
  autoUpdater.logger = console;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', (info) => {
    dialog.showMessageBox({
      type: 'info', title: 'Actualizacion Disponible',
      message: `AndroProject v${info.version} disponible. Descargando en segundo plano...`,
      buttons: ['Aceptar']
    }).catch(() => {});
  });
  autoUpdater.on('update-downloaded', (info) => {
    dialog.showMessageBox({
      type: 'info', title: 'Actualizacion Lista',
      message: `v${info.version} descargada. La app se reiniciara para aplicar los cambios.`,
      buttons: ['Reiniciar']
    }).then(() => { autoUpdater.quitAndInstall(); }).catch(() => { autoUpdater.quitAndInstall(); });
  });
}

// ── Next.js Server ─────────────────────────────────────────────────────
function waitForServer(retries = 40) {
  return new Promise((resolve, reject) => {
    let n = 0;
    const check = () => {
      n++;
      http.get(SERVER_URL, (res) => {
        if (res.statusCode < 500) resolve();
        else retry();
      }).on('error', () => { if (n >= retries) reject(new Error('Timeout')); else retry(); });
    };
    const retry = () => setTimeout(check, 800);
    check();
  });
}

function startNextServer() {
  if (app.isPackaged) {
    try {
      const logPath = path.join(process.resourcesPath, 'next-server.log');
      const logStream = fs.createWriteStream(logPath, { flags: 'a' });
      serverProcess = spawn(process.execPath, [path.join(process.resourcesPath, 'next-standalone', 'server.js')], {
        cwd: path.join(process.resourcesPath, 'next-standalone'),
        env: { ...process.env, PORT: String(PORT), NODE_ENV: 'production', ELECTRON_RUN_AS_NODE: '1' }
      });
      serverProcess.stdout.pipe(logStream);
      serverProcess.stderr.pipe(logStream);
    } catch (e) { console.error('[Init] Failed to spawn Next.js server:', e); }
  } else {
    serverProcess = spawn('npm', ['run', 'start:server'], {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, PORT: String(PORT) },
      stdio: 'ignore',
      shell: true,
    });
  }
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280, height: 820, minWidth: 960, minHeight: 640,
    icon: getAssetPath('icon.png'),
    backgroundColor: '#0d0f1a',
    title: 'AndroProject v2.1.0',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: !app.isPackaged,
      backgroundThrottling: false,
    },
  });
  mainWindow.setMenuBarVisibility(false);
  mainWindow.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(SERVER_URL)) event.preventDefault();
  });

  // ── Minimizar a bandeja en vez de cerrar ──────────────────────────
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  await mainWindow.loadURL(SERVER_URL);
  mainWindow.show();
  mainWindow.focus();
}

// ── ADB Radar ──────────────────────────────────────────────────────────
async function initializeADBAndRadar() {
  console.log('[Init] Restarting ADB server...');
  const { exec } = require('child_process');
  exec(`"${ADB}" kill-server`, () => {
    exec(`"${ADB}" start-server`, () => {
      console.log('[Init] ADB server started. Scanning subnet...');
      const psScript = `
        $localIp = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -match "Wi-Fi|Ethernet" -and $_.IPAddress -notlike "169.254*" } | Select-Object -First 1).IPAddress
        if (-not $localIp) { exit }
        $base = $localIp.Substring(0, $localIp.LastIndexOf('.'))
        $ips = 1..254 | ForEach-Object { "$base.$_" }
        $results = @()
        foreach ($ip in $ips) {
            $tcp = New-Object System.Net.Sockets.TcpClient
            $result = $tcp.BeginConnect($ip, 5555, $null, $null)
            $results += [PSCustomObject]@{ IP = $ip; AsyncResult = $result; Tcp = $tcp }
        }
        Start-Sleep -Milliseconds 600
        foreach ($r in $results) {
            if ($r.AsyncResult.IsCompleted -and $r.Tcp.Connected) {
                Write-Output $r.IP; $r.Tcp.Close(); exit
            }
            $r.Tcp.Close()
        }
      `;
      const encoded = Buffer.from(psScript, 'utf16le').toString('base64');
      exec(`powershell -ExecutionPolicy Bypass -NoProfile -EncodedCommand ${encoded}`, (err, stdout) => {
        const ip = stdout.trim();
        if (ip) {
          console.log(`[Init] Radar found device at ${ip}:5555`);
          exec(`"${ADB}" connect ${ip}:5555`, (err, out) => { console.log(`[Init] ${out.trim()}`); });
        } else {
          console.log('[Init] Radar: No device found.');
        }
      });
    });
  });
}

function isServerRunning() {
  return new Promise((resolve) => {
    http.get(SERVER_URL, (res) => resolve(res.statusCode < 500)).on('error', () => resolve(false));
  });
}

// ── App Lifecycle ──────────────────────────────────────────────────────
app.whenReady().then(async () => {
  setupAutoUpdater();
  if (app.isPackaged && autoUpdater) {
    autoUpdater.checkForUpdatesAndNotify().catch(() => {});
  }
  createTray();
  const alreadyRunning = await isServerRunning();
  if (!alreadyRunning) {
    console.log('[Init] Starting Next.js server...');
    startNextServer();
  }
  initializeADBAndRadar();
  try {
    await waitForServer();
    await createWindow();
  } catch (e) {
    console.error('[Init] Failed:', e.message);
    app.quit();
  }
});

// ── CORREGIDO: No cerrar al cerrar ventanas (minimiza a bandeja) ──────
app.on('window-all-closed', () => {
  // No hacer nada — la app sigue en la bandeja
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('quit', () => {
  if (serverProcess) {
    try { serverProcess.kill(); } catch {}
  }
});
