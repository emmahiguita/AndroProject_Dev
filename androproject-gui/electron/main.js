const { app, BrowserWindow, Tray, Menu, nativeImage, shell, dialog, desktopCapturer, session } = require('electron');
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

// ── iOS AirPlay 2 Receiver & Mirroring ──────────────────────────────────
let airPlayProcess = null;
let iosMirrorWindow = null;
let iosMonitorTimer = null;

function getAirPlayServerPath() {
  if (app.isPackaged) {
    const p1 = path.join(process.resourcesPath, 'bin', 'airplay', 'AirPlayServer.exe');
    if (fs.existsSync(p1)) return p1;
    return path.join(process.resourcesPath, 'native', 'ios', 'AirPlayServer.exe');
  }
  const p1 = path.join(__dirname, '..', 'bin', 'airplay', 'AirPlayServer.exe');
  if (fs.existsSync(p1)) return p1;
  return path.join(__dirname, '..', 'native', 'ios', 'AirPlayServer.exe');
}

function startAirPlayReceiver() {
  const executable = getAirPlayServerPath();
  if (!fs.existsSync(executable)) {
    console.error('[iOS] AirPlayServer.exe no encontrado:', executable);
    return false;
  }
  if (airPlayProcess && !airPlayProcess.killed) {
    return true;
  }
  console.log('[iOS] Iniciando receptor AirPlay...');
  const airplayDir = path.dirname(executable);
  airPlayProcess = spawn(executable, [], {
    cwd: airplayDir,
    windowsHide: false,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      PATH: airplayDir + ';' + path.join(airplayDir, 'lib') + ';' + process.env.PATH,
    }
  });

  airPlayProcess.stdout?.on('data', data => {
    console.log('[AirPlay]', data.toString().trim());
  });

  airPlayProcess.stderr?.on('data', data => {
    console.error('[AirPlay]', data.toString().trim());
  });

  airPlayProcess.on('exit', code => {
    console.log(`[iOS] Receptor AirPlay terminado: ${code}`);
    airPlayProcess = null;
    if (iosMirrorWindow && !iosMirrorWindow.isDestroyed()) {
      iosMirrorWindow.close();
      iosMirrorWindow = null;
    }
  });

  return true;
}

async function findIOSFeed() {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['window'],
      thumbnailSize: { width: 0, height: 0 },
      fetchWindowIcons: false,
    });
    return sources.find(source =>
      source.name === 'AirPlay Receiver - Clean Feed' ||
      source.name.includes('AirPlay Receiver') ||
      source.name.includes('AirPlay')
    );
  } catch (err) {
    return null;
  }
}

function createIOSMirrorWindow() {
  if (iosMirrorWindow && !iosMirrorWindow.isDestroyed()) {
    iosMirrorWindow.focus();
    return;
  }

  iosMirrorWindow = new BrowserWindow({
    width: 430,
    height: 900,
    minWidth: 320,
    minHeight: 650,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: true,
    movable: true,
    alwaysOnTop: false,
    title: 'DEXTERAND — iPhone',
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  });

  iosMirrorWindow.loadURL(`${SERVER_URL}/ios-mirror`);

  iosMirrorWindow.once('ready-to-show', () => {
    iosMirrorWindow?.show();
    iosMirrorWindow?.focus();
  });

  iosMirrorWindow.on('closed', () => {
    iosMirrorWindow = null;
  });
}

async function monitorIOSProjection() {
  try {
    const source = await findIOSFeed();
    if (source) {
      if (!iosMirrorWindow || iosMirrorWindow.isDestroyed()) {
        console.log('[iOS] Stream detectado:', source.name);
        createIOSMirrorWindow();
      }
    } else {
      if (iosMirrorWindow && !iosMirrorWindow.isDestroyed()) {
        console.log('[iOS] Stream finalizado');
        iosMirrorWindow.close();
        iosMirrorWindow = null;
      }
    }
  } catch (error) {
    console.error('[iOS] Error detectando stream:', error);
  }
}

function startIOSMonitor() {
  if (iosMonitorTimer) {
    clearInterval(iosMonitorTimer);
  }
  iosMonitorTimer = setInterval(monitorIOSProjection, 1000);
}

function setupIOSCaptureHandler() {
  session.defaultSession.setDisplayMediaRequestHandler(async (request, callback) => {
    try {
      const source = await findIOSFeed();
      if (!source) {
        console.log('[iOS] No existe Clean Feed');
        callback({});
        return;
      }
      console.log('[iOS] Permitiendo captura:', source.name);
      callback({ video: source });
    } catch (error) {
      console.error('[iOS] Error concediendo captura:', error);
      callback({});
    }
  });
}

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
    width: 1360, height: 860, minWidth: 900, minHeight: 600,
    icon: getAssetPath('icon.png'),
    backgroundColor: '#0b0e17',
    title: 'AndroProject v2.1.0',
    show: false,
    autoHideMenuBar: true,
    center: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: !app.isPackaged,
      backgroundThrottling: false,
    },
  });
  mainWindow.setMenuBarVisibility(false);
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.includes('/popout') || url.startsWith(SERVER_URL)) {
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 440,
          height: 880,
          minWidth: 320,
          minHeight: 500,
          autoHideMenuBar: true,
          backgroundColor: '#05070c',
          webPreferences: {
            contextIsolation: true,
            nodeIntegration: false,
            sandbox: true,
            backgroundThrottling: false,
          },
        },
      };
    }
    shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(SERVER_URL)) event.preventDefault();
  });

  // Mostrar la ventana cuando esté lista para ser presentada
  mainWindow.once('ready-to-show', () => {
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
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

  try {
    await mainWindow.loadURL(SERVER_URL);
  } catch (err) {
    console.error('[Electron] Failed to load URL:', err.message);
  }

  // Asegurar que la ventana sea visible si ready-to-show ya pasó
  if (mainWindow && !mainWindow.isVisible()) {
    mainWindow.show();
    mainWindow.focus();
  }
}

// ── ADB Radar ──────────────────────────────────────────────────────────
async function initializeADBAndRadar() {
  console.log('[Init] Checking ADB server...');
  const { exec } = require('child_process');
  exec(`"${ADB}" start-server`, () => {
    console.log('[Init] ADB server started. Scanning subnet for devices...');
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
              Write-Output $r.IP
          }
          $r.Tcp.Close()
      }
    `;
    const encoded = Buffer.from(psScript, 'utf16le').toString('base64');
    exec(`powershell -ExecutionPolicy Bypass -NoProfile -EncodedCommand ${encoded}`, (err, stdout) => {
      const foundIps = (stdout || '')
        .split(/\r?\n/)
        .map(s => s.trim())
        .filter(s => s && /^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$/.test(s));

      if (foundIps.length > 0) {
        console.log(`[Init] Radar found ${foundIps.length} device(s): ${foundIps.join(', ')}`);
        foundIps.forEach(ip => {
          exec(`"${ADB}" connect ${ip}:5555`, (err, out) => {
            console.log(`[Init] Connected to ${ip}:5555 -> ${(out || '').trim()}`);
          });
        });
      } else {
        console.log('[Init] Radar: No open 5555 devices found in subnet.');
      }
    });
  });
}

function isServerRunning() {
  return new Promise((resolve) => {
    http.get(SERVER_URL, (res) => resolve(res.statusCode < 500)).on('error', () => resolve(false));
  });
}

// ── Cleanup Helper ─────────────────────────────────────────────────────
function cleanupChildProcesses() {
  if (iosMonitorTimer) {
    clearInterval(iosMonitorTimer);
    iosMonitorTimer = null;
  }
  if (airPlayProcess && !airPlayProcess.killed) {
    try { airPlayProcess.kill(); } catch {}
    airPlayProcess = null;
  }
  if (serverProcess && !serverProcess.killed) {
    try { serverProcess.kill(); } catch {}
    serverProcess = null;
  }
  // Clean up any active scrcpy processes tracked in .androproject/locks
  try {
    const locksDir = path.join(__dirname, '..', '.androproject', 'locks');
    if (fs.existsSync(locksDir)) {
      const files = fs.readdirSync(locksDir);
      for (const file of files) {
        if (file.endsWith('.lock')) {
          const lockPath = path.join(locksDir, file);
          try {
            const raw = fs.readFileSync(lockPath, 'utf8');
            const data = JSON.parse(raw);
            if (data && data.pid) {
              try { process.kill(data.pid); } catch {}
            }
            fs.unlinkSync(lockPath);
          } catch {}
        }
      }
    }
  } catch {}
}

// ── App Lifecycle ──────────────────────────────────────────────────────
app.whenReady().then(async () => {
  setupAutoUpdater();
  if (app.isPackaged && autoUpdater) {
    autoUpdater.checkForUpdatesAndNotify().catch(() => {});
  }
  createTray();

  // ── iOS AirPlay Setup ──
  setupIOSCaptureHandler();
  startAirPlayReceiver();
  startIOSMonitor();

  // ── Next.js / Android Setup ──
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
  cleanupChildProcesses();
});

app.on('will-quit', () => {
  cleanupChildProcesses();
});

app.on('quit', () => {
  cleanupChildProcesses();
});
