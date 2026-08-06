"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import Image from 'next/image';
import {
  Smartphone, Monitor, FolderOpen, Home, Camera, Video,
  LayoutGrid, List, Settings, Wrench, Battery, Thermometer, Usb, Code, Maximize2, Minimize2, ArrowLeft, Volume2, VolumeX, ExternalLink, Sparkles,
  RefreshCw, PowerOff, Wifi, Moon, Sun,
  Copy, Clock, HardDrive, Cpu, Maximize, Hash, Eye, EyeOff, Check, Globe, Radio,
  Download, Zap, AlertTriangle,
  Shield, Search, Trash2, ShieldAlert, Bell
} from 'lucide-react';
import { InfoRow, QuickAction, ScreenBtn, StateCard } from '@/components/ui/dashboard-components';

type DeviceData = {
  connected: boolean;
  connectionType?: string;
  model?: string;
  androidVersion?: string;
  serial?: string;
  resolution?: string;
  ram?: string;
  storage?: string;
  battery?: number;
  isCharging?: boolean;
  temperature?: string;
  state?: string;
  oemUnlockAllowed?: boolean;
  bootloaderLocked?: boolean;
  verifiedBootState?: string;
  vbmetaState?: string;
};

type AppInfo = {
  packageName: string;
  name: string;
  size: number;
  date: number;
  isSystem?: boolean;
  isBloatware?: boolean;
  isHidden?: boolean;
  hasOverlay?: boolean;
  isDisabled?: boolean;
  isGoogle?: boolean;
  isMalware?: boolean;
  threatName: string;
  threatSeverity: string;
};

type DiagnosticsStorage = {
  size?: string;
  used?: string;
  free?: string;
  usage?: string;
};

type DiagnosticsData = {
  cpu?: Record<string, string>;
  ram?: Record<string, string>;
  storage?: DiagnosticsStorage;
  thermal?: string[];
  arch?: string;
  sdk?: string;
  kernel?: string;
  display_resolution?: string;
  display_dpi?: string;
  uptime?: string;
  [key: string]: string | Record<string, string> | string[] | undefined;
};

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);
const NAV_ITEMS = [
  { id: 'dashboard', label: 'Resumen', icon: Home },
  { id: 'archivos',  label: 'Archivos',  icon: FolderOpen },
  { id: 'apps',      label: 'Aplicaciones', icon: LayoutGrid },
  { id: 'curar',     label: 'Reparar apps', icon: Shield },
  { id: 'tools',     label: 'Herramientas',  icon: Wrench },
  { id: 'flasher',   label: 'Flashear ROM', icon: Zap },
  { id: 'optimizar', label: 'Optimizaci\u00f3n', icon: Sparkles },
  { id: 'config',    label: 'Ajustes', icon: Settings },
];

const NAV_TITLES = Object.fromEntries(NAV_ITEMS.map(({ id, label }) => [id, label]));

const PARTITIONS = [
  { id: 'boot',        label: 'Boot',        desc: 'Kernel y arranque del sistema', critical: false },
  { id: 'recovery',    label: 'Recovery',    desc: 'Sistema de recuperación', critical: false },
  { id: 'system',      label: 'System',      desc: 'Sistema operativo Android', critical: false },
  { id: 'vendor',      label: 'Vendor',      desc: 'Drivers del fabricante', critical: false },
  { id: 'vendor_boot', label: 'Vendor Boot', desc: 'Arranque del fabricante (Android 12+)', critical: false },
  { id: 'init_boot',   label: 'Init Boot',   desc: 'Inicialización de arranque (Android 13+)', critical: false },
  { id: 'dtbo',        label: 'DTBO',        desc: 'Device Tree Overlay', critical: false },
  { id: 'vbmeta',      label: 'VBMeta',      desc: 'Verificación de arranque', critical: false },
  { id: 'super',       label: 'Super',       desc: 'Partición dinámica (A/B)', critical: false },
  { id: 'product',     label: 'Product',     desc: 'Apps del fabricante', critical: false },
  { id: 'userdata',    label: 'Userdata',    desc: 'Datos de usuario (PELIGRO)', critical: false },
  // A/B slots
  { id: 'boot_a',      label: 'Boot A',      desc: 'Slot A - Kernel', critical: false },
  { id: 'boot_b',      label: 'Boot B',      desc: 'Slot B - Kernel', critical: false },
  { id: 'recovery_a',  label: 'Recovery A',  desc: 'Slot A - Recovery', critical: false },
  { id: 'recovery_b',  label: 'Recovery B',  desc: 'Slot B - Recovery', critical: false },
  // Particiones críticas de bajo nivel
  { id: 'bootloader',  label: 'Bootloader', desc: 'CRÍTICO: gestor de arranque — brick si falla', critical: true },
  { id: 'radio',       label: '⚠ Radio/Modem', desc: 'CRÍTICO: firmware de radio/baseband', critical: true },
  { id: 'modem',       label: '⚠ Modem',       desc: 'CRÍTICO: partición del módem', critical: true },
  { id: 'persist',     label: '⚠ Persist',     desc: 'CRÍTICO: calibración de sensores (IMEI, MAC)', critical: true },
  { id: 'misc',        label: '⚠ Misc',        desc: 'CRÍTICO: configuración de arranque', critical: true },
  { id: 'logo',        label: 'Logo',          desc: 'Logo de arranque (splash)', critical: false },
];

export default function Dashboard() {
  const [device, setDevice] = useState<DeviceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<string[]>([]);
  const [activeNav, setActiveNav] = useState('dashboard');
  const [dark, setDark] = useState(() => typeof window === 'undefined' || window.localStorage.getItem('androproject-theme') !== 'light');
  const [isScreenExpanded, setIsScreenExpanded] = useState(true);
  const [deviceIP, setDeviceIP] = useState<string | null>(null);
  const [devicesList, setDevicesList] = useState<Array<{ serial: string; model: string; connectionType: string }>>([]);
  const [activeSerial, setActiveSerial] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [videoSource, setVideoSource] = useState<'display' | 'camera'>('display');
  const [isScreenStreaming, setIsScreenStreaming] = useState(false);
  const [screenBusy, setScreenBusy] = useState(false);
  const [recordingPath, setRecordingPath] = useState<string | null>(null);
  const [recordingStartTime, setRecordingStartTime] = useState<number | null>(null);
  const [recordingElapsed, setRecordingElapsed] = useState('00:00');

  // ── Flash State ──
  const [flashState, setFlashState] = useState<string>('unknown');
  const [flashInfo, setFlashInfo] = useState<Record<string, string>>({});
  const [selectedPartition, setSelectedPartition] = useState('boot');
  const [flashFile, setFlashFile] = useState<File | null>(null);
  const [flashing, setFlashing] = useState(false);
  const [flashProgress, setFlashProgress] = useState('');

  // ── File Upload State ──
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});

  // ── App Radar State ──
  const [foregroundApp, setForegroundApp] = useState<string>('Buscando...');
  const secureAppsList = [
    'com.badoo.mobile', 'com.jaumo', 'com.netflix.mediaclient', 'com.disney.disneyplus',
    'com.hbo.hbonow', 'tv.twitch.android.app', 'com.whatsapp', 'com.bancolombia.appbilletera',
    'com.nequi.MobileApp', 'com.daviplata.app'
  ];
  const isSecureApp = secureAppsList.includes(foregroundApp);

  // ── Patcher State ──
  const [patchPackage, setPatchPackage] = useState('');
  const [isPatching, setIsPatching] = useState(false);
  const [patchLogs, setPatchLogs] = useState<string>('');
  const [isCloneMode, setIsCloneMode] = useState(false);
  const [curarSubTab, setCurarSubTab] = useState<'antivirus' | 'screenshot'>('antivirus');

  // ── App Manager State ──
  const [appsSubTab, setAppsSubTab] = useState<'installer' | 'manager'>('installer');

  // ── Optimizador State ──
  const [optimizerTab, setOptimizerTab] = useState<'performance'|'audio'|'network'|'diagnostics'|'notifications'>('performance');
  const [animScales, setAnimScales] = useState<Record<string,string>>({window_animation_scale:'1.0',transition_animation_scale:'1.0',animator_duration_scale:'1.0'});
  const [currentDpi, setCurrentDpi] = useState<number>(420);
  const [bluetoothInfo, setBluetoothInfo] = useState<Record<string,string>>({});
  const [gpuTweaks, setGpuTweaks] = useState<{force_gpu: boolean; disable_overlays: boolean; force_msaa: boolean}>({force_gpu: false, disable_overlays: false, force_msaa: false});
  const [backgroundLimit, setBackgroundLimit] = useState<string>('standard');
  const [screenTimeout, setScreenTimeout] = useState<string>('1800000');
  const [peakRefreshRate, setPeakRefreshRate] = useState<string>('60');
  const [nightMode, setNightMode] = useState<string>('2');
  const [autoBrightness, setAutoBrightness] = useState<boolean>(false);
  const [stayAwake, setStayAwake] = useState<boolean>(false);
  const [demoMode, setDemoMode] = useState<boolean>(false);
  const [showTouches, setShowTouches] = useState<boolean>(false);
  const [wifiScanInterval, setWifiScanInterval] = useState<number>(15000);
  const [wifiPowerSave, setWifiPowerSave] = useState<boolean>(false);
  const [privateDnsMode, setPrivateDnsMode] = useState<string>('automatic');
  const [privateDnsSpecifier, setPrivateDnsSpecifier] = useState<string>('');
  const [diagnostics, setDiagnostics] = useState<DiagnosticsData | null>(null);
  const [diagLoading, setDiagLoading] = useState(false);
  // ── Notification Shade / iOS Style ──
  const [shadeHighContrast, setShadeHighContrast] = useState(false);
  const [shadeReduceBlur, setShadeReduceBlur] = useState(false);
  const [shadeBoldText, setShadeBoldText] = useState(false);
  const [shadeSolidTheme, setShadeSolidTheme] = useState(false);
  const [shadeFastAnims, setShadeFastAnims] = useState(false);
  const [shadeApplying, setShadeApplying] = useState(false);
  const [appsList, setAppsList] = useState<AppInfo[]>([]);
  const [appsLoading, setAppsLoading] = useState(false);
  const [appsFilter, setAppsFilter] = useState<'all' | 'system' | 'hidden' | 'adware' | 'disabled' | 'google' | 'malware'>('all');
  const [appsSearch, setAppsSearch] = useState('');
  const [appsSort, setAppsSort] = useState<string>('name_asc');
  const [appsViewMode, setAppsViewMode] = useState<'grid' | 'list'>('grid');
  const [appActionLoading, setAppActionLoading] = useState<string | null>(null);
  const [selectedPackages, setSelectedPackages] = useState<Set<string>>(new Set());

  // ── Estado del sistema ────────────────────────────────────────────

  const addLog = useCallback((msg: string, ts = new Date()) => {
    const t = `[${ts.toLocaleTimeString()}]`;
    setLogs(prev => [`${t} ${msg}`, ...prev].slice(0, 50));
  }, []);


  useEffect(() => {
    window.localStorage.setItem('androproject-theme', dark ? 'dark' : 'light');
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  }, [dark]);


  // ── Config data (fetched from API) ──
  const [configData, setConfigData] = useState<Record<string, string>>({});

  useEffect(() => {
    if (activeNav !== 'config') return;
    fetch('/api/config')
      .then(r => r.json())
      .then(d => setConfigData(d))
      .catch(() => {});
  }, [activeNav]);

  // CORREGIDO: rollback de isRecording si la API falla, + feedback visual
  const toggleRecord = async () => {
    if (!isRecording) {
      setIsRecording(true);
      addLog('Iniciando grabación en 2do plano...');
      const d = await run('start_record', 'Iniciando grabación en 2do plano...', { videoSource }, false);
      if (!d?.success) {
        setIsRecording(false);
        addLog(`✗ Grabación fallida: ${d?.error || 'Error de conexión'}`);
      } else {
        setRecordingPath(d.recordPath || null);
        setRecordingStartTime(Number(d.startedAt) || 0);
        addLog(`✓ Grabando en: ${d.recordPath || 'Capturas\\'}`);
      }
    } else {
      setIsRecording(false);
      setRecordingPath(null);
      setRecordingStartTime(null);
      setRecordingElapsed('00:00');
      await run('stop_record', 'Guardando video MP4...', {}, false);
    }
  };

  // CORREGIDO: Timer de grabación en vivo
  useEffect(() => {
    if (!recordingStartTime) return;
    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000);
      const m = Math.floor(elapsed / 60).toString().padStart(2, '0');
      const s = (elapsed % 60).toString().padStart(2, '0');
      setRecordingElapsed(`${m}:${s}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [recordingStartTime]);

  // CORREGIDO: Cargar datos reales del optimizador en lote al entrar en la pestaña
  useEffect(() => {
    if (activeNav !== 'optimizar' || !device?.connected) return;
    const fetchOptData = async () => {
      try {
        const res = await fetch('/api/actions', {
          method: 'POST',
          body: JSON.stringify({ action: 'get_optimizer_settings', serial: activeSerial, ip: deviceIP }),
          headers: { 'Content-Type': 'application/json' },
        });
        const data = await res.json();
        if (data.success && data.settings) {
          const s = data.settings;
          if (s.animScales) setAnimScales(s.animScales);
          if (s.dpi) setCurrentDpi(s.dpi);
          if (s.gpuTweaks) setGpuTweaks(s.gpuTweaks);
          if (s.backgroundLimit) setBackgroundLimit(s.backgroundLimit);
          if (s.screenTimeout) setScreenTimeout(String(s.screenTimeout));
          if (s.peakRefreshRate) setPeakRefreshRate(String(Math.round(parseFloat(s.peakRefreshRate))));
          if (s.nightMode) setNightMode(String(s.nightMode));
          if (s.autoBrightness !== undefined) setAutoBrightness(s.autoBrightness);
          if (s.stayAwake !== undefined) setStayAwake(s.stayAwake);
          if (s.demoMode !== undefined) setDemoMode(s.demoMode);
          if (s.showTouches !== undefined) setShowTouches(s.showTouches);
          if (s.wifiScanInterval !== undefined) setWifiScanInterval(s.wifiScanInterval);
          if (s.wifiPowerSave !== undefined) setWifiPowerSave(s.wifiPowerSave);
          if (s.privateDnsMode) setPrivateDnsMode(s.privateDnsMode);
          if (s.privateDnsSpecifier !== undefined) setPrivateDnsSpecifier(s.privateDnsSpecifier);
          if (s.bluetooth) {
            setBluetoothInfo({
              bluetooth_a2dp_codec_selection: s.bluetooth.codec,
              bluetooth_a2dp_sample_rate_selection: s.bluetooth.sampleRate,
              bluetooth_a2dp_bits_per_sample_selection: s.bluetooth.bitsPerSample,
              bluetooth_a2dp_ldac_playback_quality: s.bluetooth.ldacQuality,
              bluetooth_disable_absolute_volume: s.bluetooth.disableAbsoluteVolume ? '1' : '0',
            });
          }
          if (s.shade) {
            if (s.shade.highContrast !== undefined) setShadeHighContrast(s.shade.highContrast);
            if (s.shade.fontScale) setShadeBoldText(parseFloat(s.shade.fontScale) > 1.05);
            // Detectar si animaciones están en modo rápido
            if (s.animScales) {
              const allFast = Object.values(s.animScales).every(v => {
                const n = parseFloat(String(v));
                return !isNaN(n) && n <= 0.5;
              });
              setShadeFastAnims(allFast);
            }
          }
        }
      } catch {}
    };
    fetchOptData();
  }, [activeNav, device?.connected, activeSerial, deviceIP]);

  const togglePackageSelection = (pkgName: string) => {
    setSelectedPackages(prev => {
      const newSet = new Set(prev);
      if (newSet.has(pkgName)) {
        newSet.delete(pkgName);
      } else {
        newSet.add(pkgName);
      }
      return newSet;
    });
  };

  const toggleSelectAllFiltered = (filteredList: AppInfo[]) => {
    const filteredNames = filteredList.map(app => app.packageName);
    const allSelected = filteredNames.every(name => selectedPackages.has(name));
    setSelectedPackages(prev => {
      const newSet = new Set(prev);
      if (allSelected) {
        filteredNames.forEach(name => newSet.delete(name));
      } else {
        filteredNames.forEach(name => newSet.add(name));
      }
      return newSet;
    });
  };

  const handleBulkUninstall = async () => {
    const count = selectedPackages.size;
    if (count === 0) return;
    if (confirm(`¿Estás seguro de que deseas desinstalar/debloat las ${count} aplicaciones seleccionadas?`)) {
      setAppsLoading(true);
      let successCount = 0;
      let failCount = 0;
      const pkgs = Array.from(selectedPackages);

      for (const pkgName of pkgs) {
        addLog(`Desinstalando lote: ${pkgName}...`);
        try {
          const res = await fetch('/api/apps', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'uninstall', packageName: pkgName, serial: activeSerial })
          });
          const data = await res.json();
          if (data.success) {
            successCount++;
          } else {
            failCount++;
            addLog(`✗ Error en ${pkgName}: ${data.error}`);
          }
        } catch (err: unknown) {
          failCount++;
          addLog(`✗ Error de red en ${pkgName}: ${getErrorMessage(err)}`);
        }
      }

      addLog(`✓ Desinstalación múltiple completada: ${successCount} éxitos, ${failCount} fallos.`);
      alert(`Desinstalación en lote completada:\n\nÉxitos: ${successCount}\nFallos: ${failCount}`);
      setSelectedPackages(new Set());
      fetchApps();
    }
  };

  const fetchApps = useCallback(async () => {
    if (!activeSerial || activeSerial === 'Hardware Level') return;
    setAppsLoading(true);
    setSelectedPackages(new Set()); // Reset selections
    try {
      const res = await fetch('/api/apps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'list', serial: activeSerial })
      });
      const data = await res.json();
      if (data.success && data.apps) {
        setAppsList(data.apps);
      } else {
        addLog(`✗ Error cargando apps: ${data.error}`);
      }
    } catch (err: unknown) {
      addLog(`✗ Error de red cargando apps: ${getErrorMessage(err)}`);
    } finally {
      setAppsLoading(false);
    }
  }, [activeSerial, addLog]);

  useEffect(() => {
    if (appsSubTab === 'manager' && activeSerial && activeSerial !== 'Hardware Level') {
      fetchApps();
    }
  }, [appsSubTab, activeSerial, fetchApps]);

  const handleAppUninstall = async (pkgName: string) => {
    if (confirm(`¿Estás seguro de que deseas desinstalar/debloat el paquete: ${pkgName}?`)) {
      setAppActionLoading(pkgName);
      try {
        const res = await fetch('/api/apps', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'uninstall', packageName: pkgName, serial: activeSerial })
        });
        const data = await res.json();
        if (data.success) {
          addLog(`✓ ${data.message}`);
          fetchApps();
        } else {
          addLog(`✗ Error al desinstalar: ${data.error}`);
          alert(`Error: ${data.error}`);
        }
      } catch (err: unknown) {
        addLog(`✗ Error de red: ${getErrorMessage(err)}`);
      } finally {
        setAppActionLoading(null);
      }
    }
  };

  const handleAppDisable = async (pkgName: string) => {
    setAppActionLoading(pkgName);
    try {
      const res = await fetch('/api/apps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disable', packageName: pkgName, serial: activeSerial })
      });
      const data = await res.json();
      if (data.success) {
        addLog(`✓ ${data.message}`);
        fetchApps();
      } else {
        addLog(`✗ Error al deshabilitar: ${data.error}`);
        alert(`Error: ${data.error}`);
      }
    } catch (err: unknown) {
      addLog(`✗ Error de red: ${getErrorMessage(err)}`);
    } finally {
      setAppActionLoading(null);
    }
  };

  const handleAppEnable = async (pkgName: string) => {
    setAppActionLoading(pkgName);
    try {
      const res = await fetch('/api/apps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'enable', packageName: pkgName, serial: activeSerial })
      });
      const data = await res.json();
      if (data.success) {
        addLog(`✓ ${data.message}`);
        fetchApps();
      } else {
        addLog(`✗ Error al habilitar: ${data.error}`);
        alert(`Error: ${data.error}`);
      }
    } catch (err: unknown) {
      addLog(`✗ Error de red: ${getErrorMessage(err)}`);
    } finally {
      setAppActionLoading(null);
    }
  };

  const filteredApps = useMemo(() => {
    const filtered = appsList.filter(app => {
      const matchesSearch = app.name.toLowerCase().includes(appsSearch.toLowerCase()) ||
                            app.packageName.toLowerCase().includes(appsSearch.toLowerCase());
      if (!matchesSearch) return false;

      if (appsFilter === 'system') return app.isSystem || app.isBloatware;
      if (appsFilter === 'hidden') return app.isHidden;
      if (appsFilter === 'adware') return app.hasOverlay;
      if (appsFilter === 'disabled') return app.isDisabled;
      if (appsFilter === 'google') return app.isGoogle;
      if (appsFilter === 'malware') return app.isMalware;
      return true;
    });

    return filtered.sort((a, b) => {
      if (appsSort === 'name_asc') {
        return a.name.localeCompare(b.name);
      }
      if (appsSort === 'name_desc') {
        return b.name.localeCompare(a.name);
      }
      if (appsSort === 'date_desc') {
        return (b.date || 0) - (a.date || 0);
      }
      if (appsSort === 'date_asc') {
        return (a.date || 0) - (b.date || 0);
      }
      if (appsSort === 'size_desc') {
        return (b.size || 0) - (a.size || 0);
      }
      if (appsSort === 'size_asc') {
        return (a.size || 0) - (b.size || 0);
      }
      return 0;
    });
  }, [appsList, appsSearch, appsFilter, appsSort]);

  const startPatching = async () => {
    if (!patchPackage) return;
    setIsPatching(true);
    setPatchLogs('Iniciando...');

    let isPatchingActive = true;

    const fetchLog = async () => {
      try {
        const r = await fetch('/api/patch-app', {
          method: 'POST',
          body: JSON.stringify({ action: 'get_log' })
        });
        const data = await r.json();
        if (data.log) setPatchLogs(data.log);
      } catch {}

      if (isPatchingActive) {
        setTimeout(fetchLog, 1000);
      }
    };

    // Start polling loop — wait 500ms so the process has time to start
    setTimeout(fetchLog, 500);

    try {
      const res = await fetch('/api/patch-app', {
        method: 'POST',
        body: JSON.stringify({ action: 'patch_app', packageName: patchPackage, serial: activeSerial, isClone: isCloneMode })
      });
      const data = await res.json();
      if (!data.success) {
        addLog(`Error parcheando: ${data.error}`);
      } else {
        addLog(`Éxito: ${data.message}`);
      }
    } catch (err: unknown) {
      addLog(`Excepción: ${getErrorMessage(err)}`);
    } finally {
      isPatchingActive = false;
      // Un último fetch para asegurar que tenemos el log completo
      try {
        const r = await fetch('/api/patch-app', {
          method: 'POST',
          body: JSON.stringify({ action: 'get_log' })
        });
        const data = await r.json();
        if (data.log) setPatchLogs(data.log);
      } catch {}
      setIsPatching(false);
    }
  };

  // ── CORREGIDO: Auto-reconexión de transmisión de pantalla ────────
  // Monitorea si el proceso scrcpy/AndroProject.exe sigue vivo.
  // Si muere (por desconexión USB, crash, etc.), lo reinicia automáticamente.
  const screenReconnectAttemptRef = useRef(0);
  const maxScreenReconnect = 10;
  const wasScreenOpenRef = useRef(false);
  const deviceRef = useRef<DeviceData | null>(null);
  const previousDeviceSerialRef = useRef<string | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ── CORREGIDO: Side effects de nueva conexión fuera del setState ──
  const runNewDeviceSideEffects = useCallback((serial: string, deviceState?: string) => {
    // CORREGIDO: solo ejecutar side effects si el dispositivo está en estado 'device'
    if (deviceState && deviceState !== 'device') {
      addLog(`Dispositivo en estado '${deviceState}' — omitiendo inicialización automática.`);
      return;
    }
    // Auto-trigger seamless Wi-Fi handoff
    fetch('/api/actions', {
      method: 'POST',
      body: JSON.stringify({ action: 'enable_wifi', serial }),
      headers: { 'Content-Type': 'application/json' },
    }).then(res => res.json()).then(data => {
      if (data.ip) {
        setDeviceIP(data.ip);
        addLog('Puente inalámbrico activo. Puedes retirar el cable USB.');
      }
    }).catch(() => {});

    // Auto-trigger opening the projector screen (native window)
    addLog('Iniciando proyector de pantalla automáticamente...');
    fetch('/api/actions', {
      method: 'POST',
      body: JSON.stringify({ action: 'open_screen', serial }),
      headers: { 'Content-Type': 'application/json' },
    }).then(res => res.json()).then(data => {
      if (data.success) {
        addLog('✓ Proyector iniciado.');
        wasScreenOpenRef.current = true;
        screenReconnectAttemptRef.current = 0;
      } else {
        addLog(`✗ Error al iniciar proyector: ${data.error}`);
        // CORREGIDO: marcar como "intentado" para que auto-reconnect intente después
        wasScreenOpenRef.current = true;
        screenReconnectAttemptRef.current = 1;
      }
    }).catch(() => {
      wasScreenOpenRef.current = true;
      screenReconnectAttemptRef.current = 1;
    });
  }, [addLog]);

  const fetchDevice = useCallback(async (forcedSerial?: string) => {
    try {
      const serialToUse = forcedSerial !== undefined ? forcedSerial : activeSerial;
      const serialParam = serialToUse ? `?serial=${encodeURIComponent(serialToUse)}` : '';
      const r = await fetch(`/api/device${serialParam}`);
      const resData = await r.json();

      if (resData.connected && resData.devices) {
        setDevicesList(resData.devices);
        const d = resData.activeDevice;

        if (d?.serial && d.serial !== activeSerial) {
          setIsScreenStreaming(false);
          setActiveSerial(d.serial);
        }

        // CORREGIDO: Detectar nueva conexión fuera del updater de setState
        // para mantener la función updater pura (requisito de React 18+/19)
        const wasDisconnected = !deviceRef.current?.connected;
        const serialChanged = deviceRef.current?.serial !== d?.serial;
        const isNewConnection = d && (wasDisconnected || serialChanged);

        if (isNewConnection) {
          deviceRef.current = d;
          previousDeviceSerialRef.current = d.serial;
          addLog(`Dispositivo conectado: ${d.model} (${d.serial})`);
          addLog('Verificando permisos...');
          // Side effects diferidos para no bloquear el ciclo de renderizado
          setTimeout(() => runNewDeviceSideEffects(d.serial, d.state), 0);
        } else if (!d) {
          deviceRef.current = null;
          previousDeviceSerialRef.current = null;
        }

        setDevice(d);
      } else {
        setDevicesList([]);
        setDevice(null);
        setIsScreenStreaming(false);
        setActiveSerial(null);
        deviceRef.current = null;
        previousDeviceSerialRef.current = null;
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [activeSerial, addLog, runNewDeviceSideEffects]);

  useEffect(() => {
    const initialFetch = setTimeout(() => void fetchDevice(), 0);
    const id = setInterval(() => void fetchDevice(), 3000);
    return () => {
      clearTimeout(initialFetch);
      clearInterval(id);
    };
  }, [fetchDevice]);

  // CORREGIDO: refrescar deviceIP periódicamente (DHCP renewal)
  useEffect(() => {
    if (!activeSerial || !device?.connected) return;
    const refreshIP = async () => {
      try {
        const r = await fetch('/api/actions', {
          method: 'POST',
          body: JSON.stringify({ action: 'enable_wifi', serial: activeSerial }),
          headers: { 'Content-Type': 'application/json' },
        });
        const d = await r.json();
        if (d.ip && d.ip !== deviceIP) {
          setDeviceIP(d.ip);
          addLog(`IP actualizado: ${d.ip}`);
        }
      } catch (e) { console.error('[Device] IP refresh error:', e); }
    };
    const interval = setInterval(refreshIP, 60000); // cada 60s
    return () => clearInterval(interval);
  }, [activeSerial, addLog, device?.connected, deviceIP]);

  useEffect(() => {
    wasScreenOpenRef.current = false;
    screenReconnectAttemptRef.current = 0;
  }, [activeSerial]);
  // ── CORREGIDO: Auto-reconexión con cleanup de timeout ──
  useEffect(() => {
    if (!device?.connected || !activeSerial) return;

    // Limpiar timeout pendiente al cambiar dependencias
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    const checkScreenAlive = async () => {
      try {
        const r = await fetch('/api/actions', {
          method: 'POST',
          body: JSON.stringify({ action: 'check_screen', serial: activeSerial }),
          headers: { 'Content-Type': 'application/json' },
        });
        const d = await r.json();

        if (d.alive) {
          setIsScreenStreaming(true);
          wasScreenOpenRef.current = true;
          screenReconnectAttemptRef.current = 0;
        } else if (wasScreenOpenRef.current) {
          setIsScreenStreaming(false);
          // CORREGIDO: Si el usuario hizo clic en "Desconectar", no reconectar
          if (!device?.connected) {
            wasScreenOpenRef.current = false;
            return;
          }

          if (screenReconnectAttemptRef.current < maxScreenReconnect) {
            screenReconnectAttemptRef.current += 1;
            const delay = Math.min(1000 * Math.pow(1.5, screenReconnectAttemptRef.current - 1), 15000);
            const att = screenReconnectAttemptRef.current;
            addLog(`⚠ Transmisión detenida (${d.reason}). Auto-reconectando en ${Math.round(delay/1000)}s (${att}/${maxScreenReconnect})...`);

            // CORREGIDO: Guardar referencia al timeout para poder limpiarlo
            reconnectTimeoutRef.current = setTimeout(async () => {
              addLog(`Reconectando transmisión (intento ${att})...`);
              try {
                const r2 = await fetch('/api/actions', {
                  method: 'POST',
                  body: JSON.stringify({
                    action: 'open_screen',
                    serial: activeSerial,
                    force: true,
                    videoSource
                  }),
                  headers: { 'Content-Type': 'application/json' },
                });
                const d2 = await r2.json();
                if (d2.success) {
                  addLog('✓ Transmisión reconectada automáticamente.');
                } else {
                  addLog(`✗ Reconexión fallida: ${d2.error}`);
                }
              } catch {
                addLog('✗ Error de red en reconexión');
              }
              reconnectTimeoutRef.current = null;
            }, delay);
          } else {
            wasScreenOpenRef.current = false;
            addLog(`✗ Límite de reconexiones alcanzado. No se reintentará más.`);
          }
        }
      } catch {
        // Error de red en el check — ignorar, se reintentará en el próximo ciclo
      }
    };

    void checkScreenAlive();
    const screenCheckInterval = setInterval(checkScreenAlive, 5000);
    return () => {
      clearInterval(screenCheckInterval);
      // CORREGIDO: Limpiar timeout pendiente al desmontar
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
  }, [activeSerial, addLog, device?.connected, videoSource]);

  // Marcar que la pantalla se abrió cuando el usuario hace clic en "Abrir Pantalla"
  // o cuando se abre automáticamente al conectar. Esto ya se hace desde `run()`.
  useEffect(() => {
    if (!device?.connected) return;
    let isMounted = true;
    let timerId: NodeJS.Timeout;

    const fetchApp = async () => {
      try {
        const r = await fetch('/api/actions', {
          method: 'POST',
          body: JSON.stringify({ action: 'get_foreground_app', serial: activeSerial }),
          headers: { 'Content-Type': 'application/json' },
        });
        const d = await r.json();
        if (d.success && d.package && isMounted) {
          setForegroundApp(d.package);
        }
      } catch {}

      if (isMounted) {
        timerId = setTimeout(fetchApp, 3000);
      }
    };

    fetchApp();

    return () => {
      isMounted = false;
      clearTimeout(timerId);
    };
  }, [device?.connected, activeSerial]);

  const run = async (action: string, desc: string, extraBody: Record<string, unknown> = {}, logResult: boolean = true) => {
    // CORREGIDO: Registrar cuando se abre la pantalla para auto-reconexión
    if (action === 'open_screen') {
      wasScreenOpenRef.current = true;
      screenReconnectAttemptRef.current = 0;
    }
    // CORREGIDO: Resetear estado al desconectar intencionalmente
    if (logResult) addLog(`Ejecutando: ${desc}...`);
    try {
      const dIP = (activeSerial && activeSerial.includes(':5555')) ? activeSerial.split(':')[0] : deviceIP;
      const r = await fetch('/api/actions', {
        method: 'POST',
        body: JSON.stringify({ action, ip: dIP, serial: activeSerial, ...extraBody }),
        headers: { 'Content-Type': 'application/json' },
      });
      const d = await r.json();
      if (logResult) addLog(d.success ? `✓ ${d.message}` : `✗ ${d.error}`);

      // CORREGIDO: Limpiar estado o refrescar si el dispositivo se reporta como offline
      if (!d.success && d.error && (typeof d.error === 'string') && (d.error.includes('device offline') || d.error.includes('not found'))) {
        fetchDevice(); // Forzar refresco inmediato para sincronizar estado UI
      }

      return d; // CORREGIDO: devolver respuesta para que el caller pueda manejar errores
    } catch { if (logResult) addLog('✗ Error de conexión'); return { success: false, error: 'Error de conexión' }; }
  };






  const projectAllScreens = async () => {
    if (devicesList.length < 2 || screenBusy) return;
    setScreenBusy(true);
    const results = await Promise.all(devicesList.map(async ({ serial }) => {
      try {
        const response = await fetch('/api/actions', {
          method: 'POST',
          body: JSON.stringify({ action: 'open_screen', serial, videoSource }),
          headers: { 'Content-Type': 'application/json' },
        });
        const data = await response.json();
        return { serial, success: Boolean(data.success), error: data.error as string | undefined };
      } catch {
        return { serial, success: false, error: 'Error de conexión' };
      }
    }));
    const started = results.filter(result => result.success).length;
    const failed = results.length - started;
    if (activeSerial && results.some(result => result.serial === activeSerial && result.success)) {
      setIsScreenStreaming(true);
      wasScreenOpenRef.current = true;
    }
    addLog(failed === 0
      ? `✓ ${started} proyecciones activas.`
      : `Proyección múltiple: ${started} activas y ${failed} con error.`);
    setScreenBusy(false);
  };
  const toggleScreenStreaming = async () => {
    if (!device?.connected || screenBusy) return;
    setScreenBusy(true);
    if (isScreenStreaming) {
      wasScreenOpenRef.current = false;
      screenReconnectAttemptRef.current = 0;
      const result = await run('stop_screen', 'Deteniendo transmisión', {}, false);
      if (result?.success) {
        setIsScreenStreaming(false);
        addLog('\u2713 Transmisi\u00f3n detenida correctamente.');
      }
    } else {
      wasScreenOpenRef.current = true;
      const result = await run('open_screen', 'Iniciando transmisión', { force: true, videoSource }, false);
      if (result?.success) {
        setIsScreenStreaming(true);
        addLog(`✓ ${result.message}`);
      } else {
        wasScreenOpenRef.current = false;
        addLog(`✗ ${result?.error || 'No se pudo iniciar la transmisión'}`);
      }
    }
    setScreenBusy(false);
  };

  const sendKey = (keycode: string) => run('keyevent', `Tecla ${keycode}`, { keycode });

  // ── Theme Dictionary (OPPO ColorOS palette) ──
  const t = {
    bg: dark ? 'bg-[#111622]' : 'bg-slate-50',
    panel: dark ? 'bg-[#181c2b]' : 'bg-white',
    border: dark ? 'border-white/5' : 'border-slate-200',
    text: dark ? 'text-white' : 'text-slate-900',
    textMuted: dark ? 'text-white/45' : 'text-slate-500',
    textSub: dark ? 'text-white/28' : 'text-slate-400',
    hover: dark ? 'hover:bg-white/[0.05]' : 'hover:bg-slate-100',
    cardInner: dark ? 'bg-white/[0.03]' : 'bg-slate-100',
    dashedBorder: dark ? 'border-white/10' : 'border-slate-300',
    accent: dark ? 'text-[#22c97d]' : 'text-emerald-600',
    accentBg: dark ? 'bg-[#1bae6e]/15' : 'bg-emerald-100',
    accentBorder: dark ? 'border-[#1bae6e]/30' : 'border-emerald-300',
    accentHover: dark ? 'hover:bg-[#1bae6e]/20' : 'hover:bg-emerald-200',
  };

  return (
    <div className={`flex h-screen overflow-hidden transition-colors duration-200 ${t.bg} ${t.text}`}>

      {/* ── SIDEBAR ── */}
      <aside className={`w-52 xl:w-56 ${t.panel} flex flex-col shrink-0 transition-colors duration-200 ${dark ? 'sidebar-glow' : 'border-r border-slate-200'}`}>
        {/* Logo */}
        <div className="px-4 py-5 flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${dark ? 'bg-[#1bae6e]' : 'bg-emerald-600'}`}>
            <Smartphone size={15} className="text-white" />
          </div>
          <div>
            <p className="text-[13px] font-bold leading-none">AndroProject</p>
            <p className={`text-[9px] ${t.textSub} uppercase tracking-widest mt-0.5`}>Gestor de dispositivos</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="custom-scrollbar flex-1 overflow-y-auto px-2 pt-2" aria-label="Navegación principal">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
            <button type="button" key={id} onClick={() => setActiveNav(id)} aria-current={activeNav === id ? 'page' : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 mb-1 rounded-lg text-[13px] font-medium transition-colors duration-150 ${
                activeNav === id
                  ? dark ? 'nav-active-glow font-medium' : 'bg-emerald-600 text-white font-medium shadow-sm'
                  : `${t.textMuted} hover:text-[#22c97d] ${t.hover}`
              }`}
            >
              <Icon size={16} strokeWidth={1.8} aria-hidden="true" />{label}
            </button>
          ))}
        </nav>

        {/* Status */}
        <div className={`p-3 border-t ${t.border}`}>
          <div className={`${dark ? 'bg-white/[0.025] border border-white/[0.07]' : `${t.cardInner}`} rounded-xl p-3 transition-all duration-200`}>
            <div className="flex items-center gap-2 mb-1">
              <div className={`w-2 h-2 rounded-full ${device ? 'bg-[#22c97d]' : 'bg-slate-500'}`} />
              <span className={`text-[11px] ${t.textMuted}`}>{device ? `Conectado vía ${device.connectionType}` : 'Desconectado'}</span>
            </div>
            {device && <p className={`text-[11px] font-medium ${t.text} pl-4 truncate`}>{device.model}</p>}

          </div>
        </div>
      </aside>

      {/* ── CENTER CONTENT ── */}
      <main className="relative flex w-0 min-w-0 flex-1 flex-col overflow-hidden">
        {/* Header with Theme Toggle */}
        <header className={`h-16 w-full min-w-0 flex items-center justify-between px-5 xl:px-6 shrink-0 transition-colors duration-200 z-10 ${dark ? 'bg-[#111622]/95 border-b border-white/5' : 'bg-white/90 border-b border-slate-200'}`} style={dark ? { boxShadow: '0 1px 0 rgba(27,174,110,0.06), 0 4px 20px rgba(0,0,0,0.4)' } : {}}>
          <div className="min-w-0">
            <p className={`text-[10px] uppercase tracking-[0.18em] font-semibold ${t.textSub}`}>AndroProject Desktop</p>
            <div className="flex items-center gap-2 mt-0.5">
            <div className={`w-2 h-2 rounded-full ${device ? 'bg-[#22c97d]' : 'bg-slate-500'}`} />
              <h1 className="text-sm font-semibold truncate">{NAV_TITLES[activeNav] || 'Resumen'}</h1>
              <span className={`text-[11px] ${t.textMuted}`}>• {device ? device.model || 'Conectado' : loading ? 'Buscando dispositivo…' : 'Sin dispositivo'}</span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {devicesList.length > 1 && (
              <div className="flex items-center gap-2 mr-2">
                <Smartphone size={14} className={t.textMuted} />
                <select
                  value={activeSerial || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    setIsScreenStreaming(false);
                    setActiveSerial(val);
                    addLog(`Cambiando a dispositivo: ${val}`);
                    fetchDevice(val);
                  }}
                  className={`max-w-44 text-[12px] font-semibold py-1.5 px-3 rounded-xl border ${t.border} ${dark ? 'bg-[#0b0d19] text-white hover:border-[#1bae6e]/30' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'} outline-none cursor-pointer transition-all`}
                >
                  {devicesList.map(d => (
                    <option key={d.serial} value={d.serial} className={dark ? 'bg-[#0f1120] text-white' : 'bg-white text-slate-900'}>
                      {d.model} ({d.connectionType === 'USB' ? 'USB' : 'Wi-Fi'})
                    </option>
                  ))}
                </select>
              </div>
            )}
            <button
              onClick={() => fetchDevice()}
              disabled={loading}
              className={`p-2 rounded-lg ${t.hover} ${t.textMuted} hover:text-[#22c97d] transition-colors duration-150 disabled:opacity-50`}
              title="Actualizar dispositivo"
              aria-label="Actualizar dispositivo"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              onClick={() => setDark(!dark)}
              className={`p-2 rounded-lg ${t.hover} ${t.textMuted} hover:text-[#22c97d] transition-colors duration-150`}
              title={dark ? 'Usar tema claro' : 'Usar tema oscuro'} aria-label={dark ? 'Usar tema claro' : 'Usar tema oscuro'}
            >
              {dark ? <Sun size={16} /> : <Moon size={16} />}
            </button>
          </div>
        </header>

        {/* Dashboard View */}
        <div className={`flex min-w-0 flex-1 overflow-hidden transition-opacity duration-300 ${activeNav === 'dashboard' ? 'opacity-100 relative z-0' : 'opacity-0 absolute inset-0 pointer-events-none'}`}>
          <div className="min-w-0 flex-1 space-y-6 overflow-y-auto p-5 xl:p-6">

            {/* Device Info Card */}
            <section className={`${dark ? 'glow-card' : `${t.panel} border ${t.border} shadow-sm`} rounded-xl p-6 transition-all duration-200`}>
              <p className={`text-[10px] ${t.textSub} uppercase tracking-widest font-bold mb-5`}>Información del dispositivo</p>
              {!device ? (
                <div className={`flex flex-col items-center justify-center py-10 ${t.textSub}`}>
                  <Smartphone size={40} className="mb-3 opacity-50" />
                  <p className="text-sm">Buscando dispositivo por USB...</p>
                  <button onClick={() => run('radar', 'Radar Wi-Fi')}
                    className="mt-5 flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 font-medium text-xs transition-all border border-blue-500/20">
                    <Wifi size={14} /> Conectar vía Wi-Fi
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
                  <div className="w-28 h-40 device-neon-frame flex items-center justify-center shrink-0 relative overflow-hidden">
                    <div className="absolute inset-0 bg-[linear-gradient(rgba(27,174,110,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(27,174,110,0.03)_1px,transparent_1px)] bg-[size:10px_10px] pointer-events-none" />
                    <Smartphone size={44} className="text-[#22c97d] z-10" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-4">
                      <h2 className="text-xl font-bold">{device.model}</h2>
                      <span className="text-[10px] px-2.5 py-1 rounded-full bg-green-500/15 text-green-500 border border-green-500/30 font-medium flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-green-500"/> Conectado</span>
                      <button
                        onClick={() => run('enable_wifi', 'Activando puente Inalámbrico')}
                        className={`text-[10px] px-3 py-1 rounded-full ${dark ? 'bg-blue-500/15 text-blue-400 border-blue-500/30 hover:bg-blue-500/25' : 'bg-blue-100 text-blue-600 border-blue-200 hover:bg-blue-200'} border font-medium flex items-center gap-1.5 transition-colors shadow-sm ml-2`}
                        title="Convierte la conexión USB actual en una conexión Wi-Fi permanente."
                      >
                        <Wifi size={12} /> Activar Wi-Fi
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-[13px]">
                      <InfoRow dark={dark} icon={<Smartphone size={16} />} label="Modelo" value={device.model || '--'} />
                      <InfoRow dark={dark} icon={<Cpu size={16} />} label="Android" value={(() => {
                        const ver = device.androidVersion || '--';
                        if (device.state !== 'device' || ver === '--') return ver;
                        const names: Record<string, string> = {
                          '10': 'Q',
                          '11': 'Red Velvet Cake',
                          '12': 'Snow Cone',
                          '13': 'Tiramisu',
                          '14': 'Upside Down Cake',
                          '15': 'Vanilla Ice Cream'
                        };
                        return names[ver] ? `${ver} (${names[ver]})` : ver;
                      })()} />
                      <InfoRow dark={dark} icon={<Maximize size={16} />} label="Resolución" value={device.resolution || '--'} />
                      <InfoRow dark={dark} icon={<Cpu size={16} />} label="Memoria RAM" value={device.ram || '--'} />
                      <InfoRow dark={dark} icon={<HardDrive size={16} />} label="Almacenamiento" value={device.storage || '--'} />
                      <InfoRow dark={dark} icon={<Hash size={16} />} label="Número de serie" value={device.serial || '--'} />
                      {device.oemUnlockAllowed !== undefined && (
                        <InfoRow dark={dark} icon={<Settings size={16} />} label="Desbloqueo OEM" value={device.oemUnlockAllowed ? 'Permitido' : 'Bloqueado'} />
                      )}
                      {device.bootloaderLocked !== undefined && (
                        <InfoRow dark={dark} icon={<Shield size={16} />} label="Bootloader" value={device.bootloaderLocked ? 'Bloqueado' : 'Abierto'} />
                      )}
                      {device.verifiedBootState !== undefined && device.verifiedBootState !== 'unknown' && (
                        <InfoRow dark={dark} icon={<Shield size={16} />} label="Verified Boot" value={device.verifiedBootState} />
                      )}
                      {device.vbmetaState !== undefined && device.vbmetaState !== 'unknown' && (
                        <InfoRow dark={dark} icon={<Code size={16} />} label="Estado VBMeta" value={device.vbmetaState} />
                      )}
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* State cards */}
            {device && (
              <section className="">
                <p className={`text-[10px] ${t.textSub} uppercase tracking-widest font-bold mb-4`}>Estado en tiempo real</p>
                <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 xl:gap-4">
                  <StateCard dark={dark} icon={<Battery size={20} className="text-green-500" />} title="Batería" value={`${device.battery}%`} sub={device.isCharging ? 'Cargando' : 'Descargando'} color="green" progress={device.battery} />
                  <StateCard dark={dark} icon={<Thermometer size={20} className="text-blue-500" />} title="Temperatura" value={`${device.temperature ?? '--'} °C`} sub={(() => { const t = Number(device.temperature); return t > 45 ? 'Caliente' : t > 38 ? 'Tibia' : 'Normal'; })()} color="blue" />
                  <StateCard dark={dark} icon={device.connectionType?.includes('Wi-Fi') && !device.connectionType?.includes('USB') ? <Wifi size={20} className="text-blue-500" /> : <Usb size={20} className="text-blue-500" />} title="Conexión" value={device.connectionType || 'USB'} sub="Activa" color="blue" />
                  <StateCard dark={dark} icon={<Code size={20} className="text-emerald-500" />} title="Depuración" value="Habilitada" sub="Autorizado" color="emerald" />
                </div>
              </section>
            )}

            {/* App Radar */}
            {device && (
              <section className="">
                <p className={`text-[10px] ${t.textSub} uppercase tracking-widest font-bold mb-4 flex items-center gap-2`}>
                  <Shield size={12} className={isSecureApp ? 'text-red-500' : 'text-emerald-500'} /> Aplicación activa
                </p>
                <div className={`p-4 rounded-xl border ${isSecureApp ? 'bg-red-500/10 border-red-500/30' : dark ? 'bg-[#1bae6e]/5 border-[#1bae6e]/20' : 'bg-slate-100 border-slate-200'} transition-all duration-200 flex items-center justify-between`}>
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isSecureApp ? 'bg-red-500/20 text-red-500' : 'bg-[#1bae6e]/20 text-[#22c97d]'}`}>
                      <LayoutGrid size={20} className={foregroundApp !== 'Buscando...' ? 'animate-pulse' : ''} />
                    </div>
                    <div>
                      <p className="text-[11px] uppercase tracking-widest opacity-70 mb-0.5">En pantalla:</p>
                      <p className={`text-sm font-bold ${isSecureApp ? 'text-red-500' : ''}`}>{foregroundApp}</p>
                    </div>
                  </div>
                  {isSecureApp && (
                    <div className="flex flex-col items-end">
                      <p className="text-xs font-bold text-red-500 mb-1 flex items-center gap-1">
                        <AlertTriangle size={14} /> ¡Proyección Bloqueada!
                      </p>
                      <button
                        onClick={() => { setPatchPackage(foregroundApp); setActiveNav('curar'); }}
                        className="text-[10px] bg-red-500 hover:bg-red-600 text-white px-3 py-1.5 rounded-lg font-bold transition-all"
                      >
                        Revisar aplicación
                      </button>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Quick Actions */}
            <section className="">
              <p className={`text-[10px] ${t.textSub} uppercase tracking-widest font-bold mb-4`}>Acciones rápidas</p>
              <div className="grid grid-cols-2 gap-3">
                <QuickAction dark={dark} icon={<Camera size={20} />} title="Capturar pantalla" sub="Guardar imagen PNG" color="neutral" onClick={() => run('screenshot', 'Capturando pantalla')} />
                <QuickAction dark={dark} icon={<Video size={20} />} title={isRecording ? "Detener grabación" : "Grabar pantalla"} sub={isRecording ? "Guardando MP4…" : "Crear vídeo MP4"} color={isRecording ? "danger" : "neutral"} onClick={toggleRecord} />
                <QuickAction dark={dark} icon={<FolderOpen size={20} />} title="Explorar archivos" sub="Memoria del dispositivo" color="neutral" onClick={() => setActiveNav('archivos')} />
                <QuickAction dark={dark} icon={<RefreshCw size={20} />} title="Reiniciar ADB" sub="Restablecer la conexión" color="neutral" onClick={() => run('restart_adb', 'Reiniciando ADB')} />
              </div>
              {/* CORREGIDO: Indicador visual de grabación activa */}
              {isRecording && (
                <div className={`mt-4 px-4 py-3 rounded-xl flex items-center gap-3  ${
                  dark ? 'bg-red-500/10 border border-red-500/25' : 'bg-red-50 border border-red-200'
                }`}>
                  <span className="relative flex h-3 w-3">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-bold ${dark ? 'text-red-400' : 'text-red-600'}`}>
                      ● Grabando {recordingElapsed}
                    </p>
                    {recordingPath && (
                      <p className="text-[10px] dark:text-red-300/60 text-red-400/70 truncate mt-0.5">
                        {recordingPath.replace(/^.*[\\/]/, '…\\Capturas\\')}
                      </p>
                    )}
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    dark ? 'bg-red-500/20 text-red-300 border border-red-500/30' : 'bg-red-100 text-red-600 border border-red-200'
                  }`}>
                    {videoSource === 'camera' ? 'Cámara' : 'Pantalla'} · 60 FPS
                  </span>
                </div>
              )}
            </section>

            {/* Logs */}
            <section className={`${dark ? 'glow-card' : `${t.panel} border ${t.border}`} rounded-xl p-5 transition-all duration-200 `}>
              <div className="flex items-center justify-between mb-4">
                <p className={`text-[10px] ${t.textSub} uppercase tracking-widest font-bold`}>Registro del sistema</p>
                <button onClick={() => setLogs([])} className={`text-[10px] ${t.textSub} hover:text-[#22c97d] transition-colors px-2 py-1 rounded-md ${t.hover}`}>Limpiar</button>
              </div>
              <div className={`space-y-1.5 font-mono text-[11px] h-32 overflow-y-auto pr-2 custom-scrollbar ${t.textMuted}`}>
                {logs.length === 0 && <p className="opacity-50 italic">Esperando actividad...</p>}
                {logs.map((l, i) => (
                  <div key={i} className="flex items-center gap-2.5 ">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
                    {l}
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* ── RIGHT PANEL: Interactive Live Screen ── */}
          <aside className={`${dark ? 'bg-[#090b15]' : 'bg-slate-100'} flex flex-col shrink-0 transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)] relative ${isScreenExpanded ? 'w-80 max-[1399px]:absolute max-[1399px]:inset-y-0 max-[1399px]:right-0 max-[1399px]:z-30 max-[1399px]:shadow-2xl' : `w-12 ${t.panel}`}`} style={dark && isScreenExpanded ? { borderLeft: '1px solid rgba(0,229,255,0.12)', boxShadow: '-4px 0 30px rgba(0,229,255,0.06), -10px 0 30px -15px rgba(0,0,0,0.5)' } : dark ? { borderLeft: '1px solid transparent' } : { borderLeft: '1px solid #e2e8f0' }}>

            <button type="button"
              onClick={() => setIsScreenExpanded(!isScreenExpanded)}
              aria-label={isScreenExpanded ? 'Contraer panel de proyección' : 'Expandir panel de proyección'}
              className={`absolute -left-4 top-1/2 -translate-y-1/2 z-50 w-8 h-8 bg-[#22c97d] rounded-full flex items-center justify-center shadow-sm border-2 ${dark ? 'border-[#0d0f1a] text-[#07150f]' : 'border-white text-white'} hover:bg-[#4ade96] transition-all`}
            >
              {isScreenExpanded ? <Minimize2 size={12} /> : <Monitor size={12} />}
            </button>

            <div className={`flex flex-col h-full w-80 transition-all duration-200 ${isScreenExpanded ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-10 pointer-events-none'}`}>
              <div className={`flex items-center justify-between px-5 py-4 border-b ${t.border}`}>
                <span className={`text-[12px] font-bold ${t.text} flex items-center gap-2`}><Radio size={14} className={isScreenStreaming ? 'text-emerald-400' : t.textMuted}/> Proyección del dispositivo <span className={`ml-auto text-[9px] px-2 py-1 rounded-full ${isScreenStreaming ? 'bg-emerald-500/10 text-emerald-400' : t.cardInner}`}>{isScreenStreaming ? 'Activa' : 'Inactiva'}</span></span>
              </div>

              <div className="flex-1 p-4 flex flex-col items-center justify-center overflow-hidden">
                {!device ? (
                  <div className={`text-center ${t.textSub}`}>
                    <Monitor size={48} className="mx-auto mb-4 opacity-30" />
                    <p className="text-xs font-medium">No hay señal</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center w-full h-full ">
                    <div className={`relative w-full flex-1 flex flex-col items-center justify-center ${dark ? 'bg-black/40' : 'bg-slate-200'} rounded-xl overflow-hidden group ${dark ? 'screen-frame' : 'border border-slate-200 shadow-inner'} p-6 text-center`}>
                      <div className="w-16 h-16 rounded-full bg-[#1bae6e]/10 flex items-center justify-center mb-4">
                        <Smartphone size={32} className="text-[#22c97d]" />
                      </div>
                      <h3 className={`text-sm font-bold mb-2 ${t.text}`}>{isScreenStreaming ? 'Transmitiendo al PC' : 'Listo para transmitir'}</h3>
                      <p className={`text-[11px] leading-relaxed max-w-[210px] ${t.textMuted}`}>{isScreenStreaming ? 'La imagen se abri&oacute; en una ventana independiente de baja latencia.' : 'Controla tu Android desde el PC con hasta 60 FPS por USB o Wi-Fi.'}</p>
                    </div>

                    {devicesList.length > 1 && (
                      <button
                        type="button"
                        onClick={projectAllScreens}
                        disabled={screenBusy}
                        className={`mt-4 w-full rounded-xl border px-3 py-2.5 text-[11px] font-semibold transition-colors duration-150 disabled:opacity-50 ${dark ? 'border-white/[0.08] bg-white/[0.03] text-white/70 hover:border-[#1bae6e]/30 hover:text-[#34d399]' : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:text-emerald-700'}`}
                      >
                        Proyectar todos los dispositivos ({devicesList.length})
                      </button>
                    )}
                    {/* Segmented Source Selector */}
                    <div className="mt-4 flex w-full bg-slate-950/65 rounded-xl p-1 border border-white/5 shadow-inner">
                      <button
                        onClick={() => setVideoSource('display')}
                        className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all ${
                          videoSource === 'display'
                            ? 'bg-[#1bae6e]/20 text-[#34d399] border border-[#1bae6e]/25 shadow-sm'
                            : 'text-gray-400 hover:text-white border border-transparent'
                        }`}
                      >
                        Pantalla
                      </button>
                      <button
                        onClick={() => setVideoSource('camera')}
                        className={`flex-1 py-1.5 text-[10px] font-bold rounded-lg transition-all ${
                          videoSource === 'camera'
                            ? 'bg-[#1bae6e]/20 text-[#34d399] border border-[#1bae6e]/25 shadow-sm'
                            : 'text-gray-400 hover:text-white border border-transparent'
                        }`}
                      >
                        C&aacute;mara
                      </button>
                    </div>

                    <button
                      onClick={toggleScreenStreaming} disabled={screenBusy}
                      className={`mt-3 w-full py-3 rounded-xl font-medium text-[13px] flex items-center justify-center gap-2 transition-all active:translate-y-0 active:scale-[0.98] ${
                        dark
                          ? 'btn-neon bg-transparent text-[#34d399]'
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm'
                      }`}
                    >
                      {screenBusy ? <RefreshCw size={16} className="animate-spin" /> : isScreenStreaming ? <PowerOff size={16} /> : <Maximize2 size={16} />} {screenBusy ? 'Procesando…' : isScreenStreaming ? 'Detener transmisi&oacute;n' : 'Transmitir pantalla'}
                    </button>
                  </div>
                )}
              </div>

              <div className={`border-t ${t.border} ${t.panel} p-3`}>
                <div className={`flex justify-between items-center ${t.cardInner} rounded-xl overflow-hidden p-1.5 shadow-sm`}>
                  <ScreenBtn dark={dark} icon={<ArrowLeft size={18} />} label="Atrás" onClick={() => sendKey('KEYCODE_BACK')} />
                  <ScreenBtn dark={dark} icon={<Home size={18} />} label="Inicio" onClick={() => sendKey('KEYCODE_HOME')} primary />
                  <ScreenBtn dark={dark} icon={<Clock size={18} />} label="Apps" onClick={() => sendKey('KEYCODE_APP_SWITCH')} />
                  <div className={`w-px h-6 ${t.border} mx-2`} />
                  <ScreenBtn dark={dark} icon={<VolumeX size={18} />} label="Vol-" onClick={() => sendKey('KEYCODE_VOLUME_DOWN')} />
                  <ScreenBtn dark={dark} icon={<Volume2 size={18} />} label="Vol+" onClick={() => sendKey('KEYCODE_VOLUME_UP')} />
                </div>
              </div>
            </div>
          </aside>
        </div>

        {/* ── APK INSTALLER & APP MANAGER VIEW ── */}
        <div className={`min-w-0 max-w-full flex-1 overflow-x-hidden overflow-y-auto p-4 md:p-6 transition-all duration-200 ${activeNav === 'apps' ? 'opacity-100 translate-y-0 relative z-0' : 'opacity-0 translate-y-4 absolute inset-0 pointer-events-none'}`}>

          {/* Navigation Sub-Tabs */}
          <div className="custom-scrollbar flex gap-6 overflow-x-auto border-b border-white/5 pb-3">
            <button
              onClick={() => setAppsSubTab('installer')}
              className={`pb-2 text-sm font-bold transition-all relative ${
                appsSubTab === 'installer'
                  ? 'text-[#22c97d] border-b-2 border-[#1bae6e]'
                  : `${t.textMuted} hover:text-white`
              }`}
            >
              Instalar APK
            </button>
            <button
              onClick={() => setAppsSubTab('manager')}
              className={`pb-2 text-sm font-bold transition-all relative ${
                appsSubTab === 'manager'
                  ? 'text-[#22c97d] border-b-2 border-[#1bae6e]'
                  : `${t.textMuted} hover:text-white`
              }`}
            >
              Administrar Aplicaciones
            </button>
          </div>

          {appsSubTab === 'installer' ? (
            <div className={`mx-auto w-full min-w-0 max-w-3xl ${dark ? 'glow-card' : `${t.panel} border ${t.border} shadow-sm`} rounded-xl p-8`}>
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 rounded-xl bg-[#1bae6e]/10 flex items-center justify-center text-[#22c97d] shadow-inner"><LayoutGrid size={24} /></div>
                <div>
                  <h2 className="text-lg font-bold">Instalar archivos APK</h2>
                  <p className={`text-sm ${t.textMuted} mt-1`}>Selecciona uno o varios archivos APK para instalarlos en el dispositivo conectado.</p>
                </div>
              </div>

              <div className={`border-2 border-dashed ${t.dashedBorder} transition-all duration-200 rounded-xl p-14 flex flex-col items-center justify-center ${t.bg} relative group hover:bg-[#1bae6e]/5`} style={dark ? { borderColor: 'rgba(0,229,255,0.2)' } : {}} onMouseEnter={e => { if(dark) (e.currentTarget as HTMLElement).style.borderColor='rgba(0,229,255,0.6)'; (e.currentTarget as HTMLElement).style.boxShadow=dark?'0 0 20px rgba(0,229,255,0.1)':''; }} onMouseLeave={e => { if(dark) (e.currentTarget as HTMLElement).style.borderColor='rgba(0,229,255,0.2)'; (e.currentTarget as HTMLElement).style.boxShadow=''; }}>
                <input
                  type="file"
                  accept=".apk"
                  multiple
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  onChange={async (e) => {
                    const files = Array.from(e.target.files || []);
                    if (files.length === 0) return;

                    for (const file of files) {
                      addLog(`Instalando ${file.name}...`);
                      const formData = new FormData();
                      formData.append('file', file);
                      if (activeSerial) {
                        formData.append('serial', activeSerial);
                      }
                      try {
                        const res = await fetch('/api/install-apk', { method: 'POST', body: formData });
                        const data = await res.json();
                        addLog(data.success ? `✓ ${data.message}` : `✗ Error: ${data.error}`);
                      } catch { addLog(`✗ Error de red al instalar ${file.name}`); }
                    }
                    e.target.value = '';
                  }}
                />
                <div className={`w-16 h-16 rounded-xl ${t.cardInner} group-hover:bg-emerald-500/10 flex items-center justify-center ${t.textSub} group-hover:text-emerald-500 transition-colors mb-5`}>
                  <ExternalLink size={28} />
                </div>
                <p className="text-base font-semibold group-hover:text-emerald-500 transition-colors">Suelta el archivo APK aquí</p>
                <p className={`text-xs ${t.textSub} mt-2`}>También puedes hacer clic para seleccionar archivos. Máximo: 500 MB.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* App Manager header card */}
              <div className={`${dark ? 'glow-card' : `${t.panel} border ${t.border} shadow-sm`} rounded-xl p-6`}>
                <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-[#1bae6e]/10 flex items-center justify-center text-[#22c97d] shadow-inner"><LayoutGrid size={24} /></div>
                    <div>
                      <h2 className="text-lg font-bold">Administrador de Aplicaciones</h2>
                      <p className={`text-xs ${t.textMuted} mt-0.5`}>Inspecciona bloatware, aplicaciones ocultas, adware y software del sistema.</p>
                    </div>
                  </div>

                  {/* Actions & Live Ad Scanner */}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={async () => {
                        addLog('Detectando la aplicación activa...');
                        try {
                          const r = await fetch('/api/actions', {
                            method: 'POST',
                            body: JSON.stringify({ action: 'get_foreground_app', serial: activeSerial }),
                            headers: { 'Content-Type': 'application/json' },
                          });
                          const d = await r.json();
                          if (d.success && d.package) {
                            addLog(`✓ App activa en pantalla: ${d.package}`);
                            setAppsSearch(d.package);
                            setAppsFilter('all');
                            alert(`App detectada en pantalla:\n\nPaquete: ${d.package}\n\nHemos filtrado la lista con este paquete para que puedas revisarlo o desinstalarlo inmediatamente.`);
                          } else {
                            addLog('✗ No se pudo determinar la app en pantalla');
                          }
                        } catch {
                          addLog('✗ Error de conexión al escanear pantalla');
                        }
                      }}
                      className="px-3.5 py-2 text-xs font-bold bg-emerald-500/10 hover:bg-emerald-500/20 text-[#22c97d] border border-emerald-500/25 rounded-xl flex items-center gap-2 transition-all"
                      title="Si aparece publicidad invasiva, presiona este botón para detectar la app culpable en vivo."
                    >
                      <Sparkles size={14} /> Detectar aplicación activa
                    </button>
                    <button
                      onClick={fetchApps}
                      disabled={appsLoading || !device?.connected}
                      className={`px-3.5 py-2 text-xs font-bold rounded-xl border transition-all ${
                        appsLoading
                          ? 'bg-[#1bae6e]/10 text-[#34d399] border-[#1bae6e]/20 cursor-wait'
                          : 'bg-[#1bae6e]/10 hover:bg-[#1bae6e]/20 text-[#22c97d] border-[#1bae6e]/30'
                      }`}
                    >
                      Actualizar lista
                    </button>
                  </div>
                </div>

                {/* Search & Filters */}
                <div className="flex flex-col xl:flex-row gap-4 mt-6 pt-5 border-t border-white/5 items-start xl:items-center justify-between">
                  <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto flex-1 items-stretch sm:items-center">
                    <div className="relative flex-1 max-w-md">
                      <Search className={`absolute left-3.5 top-1/2 -translate-y-1/2 ${t.textSub}`} size={16} />
                      <input
                        type="text"
                        placeholder="Buscar por nombre o paquete..."
                        value={appsSearch}
                        onChange={(e) => setAppsSearch(e.target.value)}
                        className={`w-full pl-10 pr-4 py-2.5 text-xs rounded-xl border ${t.border} ${dark ? 'bg-[#0a0c17] text-white focus:border-[#1bae6e]/50' : 'bg-slate-100 text-slate-900 focus:border-[#1bae6e]'} outline-none transition-all`}
                      />
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="flex items-center gap-2">
                        <span className={`text-[11px] font-bold ${t.textMuted} whitespace-nowrap`}>Ordenar:</span>
                        <select
                          value={appsSort}
                          onChange={(e) => setAppsSort(e.target.value)}
                          className={`text-[11px] font-semibold py-2 px-3 rounded-xl border ${t.border} ${dark ? 'bg-[#0a0c17] text-white hover:border-[#1bae6e]/30' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'} outline-none cursor-pointer transition-all`}
                        >
                          <option value="name_asc" className={dark ? 'bg-[#0f1120] text-white' : 'bg-white text-slate-900'}>Nombre (A-Z)</option>
                          <option value="name_desc" className={dark ? 'bg-[#0f1120] text-white' : 'bg-white text-slate-900'}>Nombre (Z-A)</option>
                          <option value="date_desc" className={dark ? 'bg-[#0f1120] text-white' : 'bg-white text-slate-900'}>Recientes</option>
                          <option value="date_asc" className={dark ? 'bg-[#0f1120] text-white' : 'bg-white text-slate-900'}>Antiguas</option>
                          <option value="size_desc" className={dark ? 'bg-[#0f1120] text-white' : 'bg-white text-slate-900'}>Pesadas (Grande)</option>
                          <option value="size_asc" className={dark ? 'bg-[#0f1120] text-white' : 'bg-white text-slate-900'}>Ligeras (Pequeño)</option>
                        </select>
                      </div>

                      <div className={`flex items-center gap-1 ${dark ? 'bg-white/[0.03] border-white/5' : 'bg-slate-100 border-slate-200'} p-1 rounded-xl border`}>
                        <button
                          onClick={() => setAppsViewMode('grid')}
                          className={`p-1.5 rounded-lg transition-all ${
                            appsViewMode === 'grid'
                              ? dark ? 'bg-[#1bae6e]/20 text-[#22c97d]' : 'bg-blue-600 text-white'
                              : `${t.textMuted} hover:text-white`
                          }`}
                          title="Vista en cuadrícula"
                        >
                          <LayoutGrid size={13} />
                        </button>
                        <button
                          onClick={() => setAppsViewMode('list')}
                          className={`p-1.5 rounded-lg transition-all ${
                            appsViewMode === 'list'
                              ? dark ? 'bg-[#1bae6e]/20 text-[#22c97d]' : 'bg-blue-600 text-white'
                              : `${t.textMuted} hover:text-white`
                          }`}
                          title="Vista en lista"
                        >
                          <List size={13} />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Filter tabs */}
                  <div className="flex flex-wrap gap-2 items-center xl:justify-end">
                    {(['all', 'system', 'hidden', 'adware', 'disabled', 'google', 'malware'] as const).map((filter) => {
                      const labels = {
                        all: 'Todas',
                        system: 'Sistema y preinstaladas',
                        hidden: 'Ocultas',
                        adware: 'Publicidad superpuesta',
                        disabled: 'Deshabilitadas',
                        google: 'Aplicaciones de Google',
                        malware: 'Posibles amenazas'
                      };
                      return (
                        <button
                          key={filter}
                          onClick={() => setAppsFilter(filter)}
                          className={`px-3 py-2 text-xs font-bold rounded-xl transition-all border ${
                            appsFilter === filter
                              ? dark
                                ? 'bg-[#1bae6e]/15 border-[#1bae6e]/40 text-[#22c97d]'
                                : 'bg-blue-100 border-blue-300 text-blue-700'
                              : dark
                                ? 'bg-white/[0.03] border-white/5 text-white/50 hover:bg-white/10 hover:text-white'
                                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          {labels[filter]}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Apps List Container */}
              {!device?.connected ? (
                <div className={`p-10 text-center ${t.textMuted} border border-dashed ${t.dashedBorder} rounded-xl`}>
                  <Smartphone size={32} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-semibold">Conecta un dispositivo para ver la lista de aplicaciones.</p>
                </div>
              ) : appsLoading ? (
                <div className="py-20 flex flex-col items-center justify-center gap-3">
                  <RefreshCw size={32} className="animate-spin text-[#22c97d]" />
                  <p className={`text-xs ${t.textMuted}`}>Cargando y analizando aplicaciones... por favor espera.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <p className={`text-[10px] ${t.textSub} uppercase tracking-widest font-bold`}>
                      Aplicaciones ({filteredApps.length})
                    </p>
                  </div>

                  {/* Bulk actions panel */}
                  {filteredApps.length > 0 && (
                    <div className={`${dark ? 'bg-white/[0.03] border-white/5' : 'bg-slate-100 border-slate-200'} border p-3 rounded-xl flex items-center justify-between mb-2`}>
                      <div className="flex items-center gap-4">
                        <button
                          onClick={() => toggleSelectAllFiltered(filteredApps)}
                          className={`text-xs font-bold transition-all ${dark ? 'text-[#22c97d] hover:text-[#34d399]' : 'text-blue-600 hover:text-blue-500'}`}
                        >
                          {filteredApps.every(app => selectedPackages.has(app.packageName))
                            ? 'Deseleccionar todo'
                            : 'Seleccionar todo'}
                        </button>

                        {selectedPackages.size > 0 && (
                          <span className={`text-xs font-bold ${dark ? 'text-white/70' : 'text-slate-700'}`}>
                            • {selectedPackages.size} seleccionadas
                          </span>
                        )}
                      </div>

                      {selectedPackages.size > 0 && (
                        <button
                          onClick={handleBulkUninstall}
                          className="px-3.5 py-1.5 rounded-lg text-xs font-bold text-white bg-red-600 hover:bg-red-500 border border-red-500/20 shadow-md flex items-center gap-1.5 transition-all"
                        >
                          <Trash2 size={13} /> Desinstalar seleccionadas
                        </button>
                      )}
                    </div>
                  )}

                  {filteredApps.length === 0 ? (
                    <div className={`p-10 text-center ${t.textMuted} border border-dashed ${t.dashedBorder} rounded-xl`}>
                      <LayoutGrid size={32} className="mx-auto mb-3 opacity-30" />
                      <p className="text-sm">No se encontraron aplicaciones que coincidan con el filtro o búsqueda.</p>
                    </div>
                  ) : appsViewMode === 'grid' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {filteredApps.map((app) => (
                        <div
                          key={app.packageName}
                          className={`${
                            dark ? 'bg-[#0f1120] border-white/5' : 'bg-white border-slate-200'
                          } border rounded-xl p-4 flex flex-col justify-between transition-all duration-200 hover:shadow-sm`}
                        >
                          <div>
                            {/* App Title & Badges */}
                            <div className="flex items-start justify-between gap-3 mb-2">
                              <div className="flex items-start gap-3 w-full">
                                <input
                                  type="checkbox"
                                  checked={selectedPackages.has(app.packageName)}
                                  onChange={() => togglePackageSelection(app.packageName)}
                                  className="mt-3 w-4 h-4 rounded border-gray-300 text-[#22c97d] focus:ring-[#1bae6e] cursor-pointer"
                                />
                                <AppIcon app={app} dark={dark} />
                                <div className="min-w-0 flex-1">
                                  <h3 className="text-sm font-bold truncate max-w-[120px] md:max-w-[150px]" title={app.name}>
                                    {app.name}
                                  </h3>
                                  <p className={`text-[11px] ${t.textMuted} font-mono truncate max-w-[120px] md:max-w-[150px]`} title={app.packageName}>
                                    {app.packageName}
                                  </p>
                                  <div className="flex flex-wrap items-center gap-2 mt-1 text-[10px] opacity-60 font-medium">
                                    {app.size > 0 && (
                                      <span className="flex items-center gap-0.5">
                                        <HardDrive size={10} />
                                        {formatBytes(app.size)}
                                      </span>
                                    )}
                                    {app.date > 0 && (
                                      <span className="flex items-center gap-0.5">
                                        <Clock size={10} />
                                        {formatDate(app.date)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Action Loading status */}
                              {appActionLoading === app.packageName && (
                                <RefreshCw size={14} className="animate-spin text-[#22c97d] shrink-0" />
                              )}
                            </div>

                            {/* Badge Badges */}
                            <div className="flex flex-wrap gap-1.5 mb-4">
                              {app.isSystem ? (
                                <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-slate-500/10 text-slate-400 border border-slate-500/20">
                                  Sistema
                                </span>
                              ) : (
                                <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                  Usuario
                                </span>
                              )}

                              {app.isGoogle && (
                                <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-sky-500/15 text-sky-400 border border-sky-500/25">
                                  Google
                                </span>
                              )}

                              {app.isBloatware && (
                                <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-[#22c97d] border border-emerald-500/20">
                                  Bloatware
                                </span>
                              )}

                              {app.isHidden && (
                                <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20" title="Esta app no tiene ícono de inicio y corre oculta">
                                  Oculta
                                </span>
                              )}

                              {app.hasOverlay && (
                                <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20" title="Tiene permisos para mostrar overlays flotantes (Adware sospechoso)">
                                  Publicidad superpuesta
                                </span>
                              )}

                              {app.isMalware && (
                                 <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-red-600 text-white border border-red-700 shadow-[0_0_10px_rgba(220,38,38,0.5)]" title={`Amenaza detectada: ${app.threatName} (Severidad: ${app.threatSeverity.toUpperCase()})`}>
                                   ⚠️ {app.threatName || 'Virus/Malware'}
                                 </span>
                               )}

                              {app.isDisabled && (
                                <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-gray-500/20 text-gray-400 border border-gray-500/30">
                                  Deshabilitada
                                </span>
                              )}
                            </div>
                          </div>

                          {/* App Controls */}
                          <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/5">
                            {app.isDisabled ? (
                              <button
                                onClick={() => handleAppEnable(app.packageName)}
                                disabled={appActionLoading !== null}
                                className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 flex items-center gap-1.5 transition-all"
                              >
                                <Eye size={12} /> Habilitar
                              </button>
                            ) : (
                              <>
                                {app.isSystem && (
                                  <button
                                    onClick={() => handleAppDisable(app.packageName)}
                                    disabled={appActionLoading !== null}
                                    className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-orange-400 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/20 flex items-center gap-1.5 transition-all"
                                  >
                                    <EyeOff size={12} /> Deshabilitar
                                  </button>
                                )}
                                <button
                                  onClick={() => handleAppUninstall(app.packageName)}
                                  disabled={appActionLoading !== null}
                                  className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 flex items-center gap-1.5 transition-all"
                                >
                                  <Trash2 size={12} /> {app.isSystem ? 'Debloat' : 'Desinstalar'}
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    /* LIST VIEW MODE */
                    <div className={`border ${t.border} rounded-xl overflow-hidden ${dark ? 'bg-[#0f1120]' : 'bg-white'} w-full`}>
                      <div className="overflow-x-auto w-full custom-scrollbar">
                        <table className="w-full text-left border-collapse min-w-[700px]">
                          <thead>
                            <tr className={`border-b ${t.border} text-[10px] font-bold ${t.textMuted} uppercase tracking-wider`}>
                              <th className="p-3 w-10 text-center">
                                <input
                                  type="checkbox"
                                  checked={filteredApps.length > 0 && filteredApps.every(app => selectedPackages.has(app.packageName))}
                                  onChange={() => toggleSelectAllFiltered(filteredApps)}
                                  className="w-4 h-4 rounded border-gray-300 text-[#22c97d] focus:ring-[#1bae6e] cursor-pointer"
                                />
                              </th>
                              <th className="p-3">Aplicación</th>
                              <th className="p-3">Clasificación</th>
                              <th className="p-3">Detalles</th>
                              <th className="p-3 text-right">Acciones</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5 dark:divide-white/5 light:divide-slate-100">
                            {filteredApps.map((app) => (
                              <tr key={app.packageName} className={`${dark ? 'hover:bg-[#1bae6e]/5' : 'hover:bg-slate-50'} transition-all text-xs`}>
                                <td className="p-3 text-center">
                                  <input
                                    type="checkbox"
                                    checked={selectedPackages.has(app.packageName)}
                                    onChange={() => togglePackageSelection(app.packageName)}
                                    className="w-4 h-4 rounded border-gray-300 text-[#22c97d] focus:ring-[#1bae6e] cursor-pointer"
                                  />
                                </td>
                                <td className="p-3">
                                  <div className="flex items-center gap-3">
                                    <AppIcon app={app} dark={dark} />
                                    <div className="min-w-0">
                                      <p className="font-bold truncate max-w-[180px] sm:max-w-[240px]" title={app.name}>{app.name}</p>
                                      <p className={`text-[10px] ${t.textMuted} font-mono truncate max-w-[180px] sm:max-w-[240px]`} title={app.packageName}>{app.packageName}</p>
                                    </div>
                                  </div>
                                </td>
                                <td className="p-3">
                                  <div className="flex flex-wrap gap-1">
                                    {app.isSystem ? (
                                      <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-slate-500/10 text-slate-400 border border-slate-500/20">Sist.</span>
                                    ) : (
                                      <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">Usuario</span>
                                    )}
                                    {app.isGoogle && (
                                      <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-400 border border-sky-500/25">Google</span>
                                    )}
                                    {app.isBloatware && (
                                      <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-[#22c97d] border border-emerald-500/20">Bloat</span>
                                    )}
                                    {app.isHidden && (
                                      <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">Oculta</span>
                                    )}
                                    {app.hasOverlay && (
                                      <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">Adware</span>
                                    )}
                                    {app.isMalware && (
                                      <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-red-600 text-white border border-red-700 shadow-[0_0_8px_rgba(220,38,38,0.45)]" title={`Amenaza: ${app.threatName} (${app.threatSeverity.toUpperCase()})`}>
                                        ⚠️ {app.threatName || 'Virus/Malware'}
                                      </span>
                                    )}
                                    {app.isDisabled && (
                                      <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-gray-500/20 text-gray-400 border border-gray-500/30">Desh.</span>
                                    )}
                                  </div>
                                </td>
                                <td className="p-3">
                                  <div className="flex flex-col gap-0.5 text-[10px] opacity-60">
                                    {app.size > 0 && <span className="flex items-center gap-1"><HardDrive size={10} /> {formatBytes(app.size)}</span>}
                                    {app.date > 0 && <span className="flex items-center gap-1"><Clock size={10} /> {formatDate(app.date)}</span>}
                                  </div>
                                </td>
                                <td className="p-3 text-right">
                                  <div className="flex items-center justify-end gap-1.5">
                                    {appActionLoading === app.packageName && (
                                      <RefreshCw size={12} className="animate-spin text-[#22c97d] mr-1.5" />
                                    )}
                                    {app.isDisabled ? (
                                      <button
                                        onClick={() => handleAppEnable(app.packageName)}
                                        disabled={appActionLoading !== null}
                                        className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 transition-all"
                                      >
                                        Habilitar
                                      </button>
                                    ) : (
                                      <>
                                        {app.isSystem && (
                                          <button
                                            onClick={() => handleAppDisable(app.packageName)}
                                            disabled={appActionLoading !== null}
                                            className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-orange-400 bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/20 transition-all"
                                          >
                                            Deshabilitar
                                          </button>
                                        )}
                                        <button
                                          onClick={() => handleAppUninstall(app.packageName)}
                                          disabled={appActionLoading !== null}
                                          className="px-2.5 py-1 rounded-lg text-[10px] font-bold text-red-400 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-all"
                                        >
                                          {app.isSystem ? 'Debloat' : 'Eliminar'}
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── APP PATCHER & ANTIVIRUS VIEW (CURAR APPS) ── */}
        <div className={`min-w-0 max-w-full flex-1 overflow-x-hidden overflow-y-auto p-4 md:p-6 transition-all duration-200 ${activeNav === 'curar' ? 'opacity-100 translate-y-0 relative z-0' : 'opacity-0 translate-y-4 absolute inset-0 pointer-events-none'}`}>
          <div className={`mx-auto w-full min-w-0 max-w-4xl ${dark ? 'settings-panel' : `${t.panel} border ${t.border} shadow-sm`} rounded-xl p-8`}>

            {/* Sub-tab selection */}
            <div className="custom-scrollbar flex gap-6 overflow-x-auto border-b border-white/10 mb-8">
              <button
                onClick={() => setCurarSubTab('antivirus')}
                className={`pb-3 px-4 font-bold text-xs border-b-2 transition-all flex items-center gap-2 ${
                  curarSubTab === 'antivirus'
                    ? 'border-emerald-500 text-emerald-400'
                    : 'border-transparent text-white/50 hover:text-white'
                }`}
              >
                <ShieldAlert size={14} /> Análisis de aplicaciones
              </button>
              <button
                onClick={() => setCurarSubTab('screenshot')}
                className={`pb-3 px-4 font-bold text-xs border-b-2 transition-all flex items-center gap-2 ${
                  curarSubTab === 'screenshot'
                    ? 'border-emerald-500 text-emerald-400'
                    : 'border-transparent text-white/50 hover:text-white'
                }`}
              >
                <Shield size={14} /> Compatibilidad de capturas
              </button>
            </div>

            {curarSubTab === 'antivirus' ? (
              <div>
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 rounded-xl bg-red-500/10 flex items-center justify-center text-red-500 shadow-inner"><ShieldAlert size={24} /></div>
                  <div>
                    <h2 className="text-lg font-bold">Análisis de seguridad</h2>
                    <p className={`text-sm ${t.textMuted} mt-1`}>Revisa aplicaciones instaladas y señala coincidencias con indicadores locales de riesgo.</p>
                  </div>
                </div>

                {appsList.length === 0 ? (
                  <div className={`border ${t.border} rounded-xl p-8 text-center ${t.bg}`}>
                    <AlertTriangle size={36} className="mx-auto mb-3 text-amber-500 opacity-60" />
                    <h3 className="font-bold text-sm mb-1">Se requiere lista de aplicaciones</h3>
                    <p className={`text-xs ${t.textMuted} mb-6 max-w-sm mx-auto`}>Carga la lista de aplicaciones instaladas para compararla con los indicadores disponibles.</p>
                    <button
                      onClick={fetchApps}
                      disabled={appsLoading || !device?.connected}
                      className="px-5 py-3 text-xs bg-[#1bae6e] hover:bg-[#22c97d] text-white font-bold rounded-xl transition-all shadow-md shadow-[#1bae6e]/10 active:scale-95"
                    >
                      {appsLoading ? 'Cargando aplicaciones...' : 'Analizar aplicaciones'}
                    </button>
                  </div>
                ) : (() => {
                  const malwareApps = appsList.filter(app => app.isMalware);
                  if (malwareApps.length === 0) {
                    return (
                      <div className={`border ${t.border} rounded-xl p-8 text-center bg-emerald-500/5 border-emerald-500/20`}>
                        <div className="w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mx-auto mb-4">
                          <Shield size={28} />
                        </div>
                        <h3 className="font-bold text-emerald-400 text-sm mb-1">Sin coincidencias conocidas</h3>
                        <p className={`text-xs ${t.textSub} mb-4 max-w-sm mx-auto`}>No se encontraron coincidencias con los indicadores locales disponibles. Este resultado no sustituye un análisis de seguridad especializado.</p>
                        <div className="grid grid-cols-2 gap-2 text-[10px] text-left max-w-xs mx-auto p-3 rounded-xl bg-white/[0.03] border border-white/5 font-semibold text-white/60">
                          <div>Anubis / Cerberus: sin coincidencias</div>
                          <div>Pegasus / Hermit: sin coincidencias</div>
                          <div>TeaBot / FluBot: sin coincidencias</div>
                          <div>SpyNote / RAT: sin coincidencias</div>
                          <div>HiddenAds: sin coincidencias</div>
                          <div>Svpeng: sin coincidencias</div>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div className="flex flex-col gap-6">
                      <div className="flex items-center justify-between p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                        <div className="flex items-center gap-3">
                          <AlertTriangle className="text-red-500" size={20} />
                          <div>
                            <p className="text-xs font-bold text-red-400">Aplicaciones sospechosas detectadas</p>
                            <p className="text-[10px] text-white/70">Se encontraron {malwareApps.length} aplicaciones que coinciden con indicadores de riesgo.</p>
                          </div>
                        </div>
                        <button
                          onClick={async () => {
                            if (!confirm(`¿Estás seguro que deseas desinstalar y depurar las ${malwareApps.length} amenazas de forma automática?`)) return;
                            addLog('Iniciando limpieza masiva de amenazas...');
                            for (const app of malwareApps) {
                              addLog(`Depurando y eliminando: ${app.packageName}...`);
                              try {
                                await fetch('/api/apps', {
                                  method: 'POST',
                                  body: JSON.stringify({ action: 'uninstall', packageName: app.packageName, serial: activeSerial }),
                                  headers: { 'Content-Type': 'application/json' },
                                });
                              } catch {}
                            }
                            addLog('✓ Limpieza masiva completada.');
                            fetchApps();
                          }}
                          className="px-3.5 py-2 text-xs font-bold bg-red-600 hover:bg-red-500 text-white rounded-xl transition-all shadow-sm shadow-red-600/20 active:scale-95"
                        >
                          Desinstalar seleccionadas
                        </button>
                      </div>

                      <div className="flex flex-col gap-3">
                        {malwareApps.map((app) => (
                          <div key={app.packageName} className={`p-5 rounded-xl border ${t.border} bg-[#0c0d18] flex flex-col gap-4`}>
                            <div className="flex items-start justify-between">
                              <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-xl bg-red-600/10 border border-red-600/20 flex items-center justify-center text-red-500 shadow-inner">
                                  <AlertTriangle size={18} />
                                </div>
                                <div>
                                  <h4 className="text-xs font-bold text-white">{app.name || app.packageName}</h4>
                                  <p className="text-[10px] text-gray-500 font-mono mt-0.5">{app.packageName}</p>
                                  <div className="flex items-center gap-1.5 mt-2">
                                    <span className="text-[8px] font-bold px-1.5 py-0.5 rounded bg-red-600 text-white">
                                      {app.threatSeverity.toUpperCase()}
                                    </span>
                                    <span className="text-[9px] font-semibold text-red-400">
                                      {app.threatName}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="p-3.5 rounded-xl bg-black/40 border border-white/5 text-[11px] text-gray-400">
                              <p className="font-bold text-white/80">Indicador detectado:</p>
                              <p className="mt-1 leading-relaxed">
                                {app.threatName.includes('Bancario') && 'Captura contraseñas de cuentas, intercepta tokens SMS de seguridad (2FA) y superpone ventanas sobre apps de banco.'}
                                {app.threatName.includes('Spyware') && 'Rastrea ubicación GPS en tiempo real, lee registros de llamadas, espía mensajes privados de chat y puede activar cámara.'}
                                {app.threatName.includes('RAT') && 'Permite a un atacante controlar tu celular a distancia de forma invisible, ver archivos, realizar capturas de pantalla y espiar chats.'}
                                {app.threatName.includes('Adware') && 'Abre anuncios de publicidad intrusivos en tu pantalla, gasta batería y datos en segundo plano instalando apps basura.'}
                                {app.threatName.includes('Ransomware') && 'Bloquea el acceso a tus archivos o cambia el PIN de bloqueo exigiendo un pago para recuperarlo.'}
                                {app.threatName.includes('Botnet') && 'Une tu celular a una red de spam que descarga archivos maliciosos ocultos de forma silenciosa.'}
                              </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-white/5">
                              <button
                                onClick={async () => {
                                  if (!confirm(`¿Deseas desinstalar completamente la amenaza ${app.packageName}?`)) return;
                                  addLog(`Eliminando amenaza: ${app.packageName}...`);
                                  const r = await fetch('/api/apps', {
                                    method: 'POST',
                                    body: JSON.stringify({ action: 'uninstall', packageName: app.packageName, serial: activeSerial }),
                                    headers: { 'Content-Type': 'application/json' },
                                  });
                                  const d = await r.json();
                                  if (d.success) {
                                    addLog(`✓ Amenaza ${app.packageName} desinstalada.`);
                                    fetchApps();
                                  } else {
                                    addLog(`✗ Error al desinstalar: ${d.error}`);
                                  }
                                }}
                                className="px-3 py-2 text-[10px] font-bold bg-red-600 hover:bg-red-500 text-white rounded-xl transition-all flex items-center gap-1.5"
                              >
                                <Trash2 size={12} /> Desinstalar aplicación
                              </button>
                              <button
                                onClick={async () => {
                                  addLog(`Forzando detención del proceso: ${app.packageName}...`);
                                  const r = await fetch('/api/apps', {
                                    method: 'POST',
                                    body: JSON.stringify({ action: 'force_stop', packageName: app.packageName, serial: activeSerial }),
                                    headers: { 'Content-Type': 'application/json' },
                                  });
                                  const d = await r.json();
                                  if (d.success) addLog(`✓ Proceso de ${app.packageName} detenido.`);
                                }}
                                className="px-3 py-2 text-[10px] font-bold bg-emerald-500/10 hover:bg-emerald-500/20 text-[#22c97d] border border-emerald-500/25 rounded-xl transition-all"
                              >
                                Forzar detención
                              </button>
                              <button
                                onClick={async () => {
                                  if (!confirm(`¿Deseas borrar por completo todos los datos y caché de ${app.packageName}?`)) return;
                                  addLog(`Purgando datos de la amenaza: ${app.packageName}...`);
                                  const r = await fetch('/api/apps', {
                                    method: 'POST',
                                    body: JSON.stringify({ action: 'clear_data', packageName: app.packageName, serial: activeSerial }),
                                    headers: { 'Content-Type': 'application/json' },
                                  });
                                  const d = await r.json();
                                  if (d.success) addLog(`✓ Almacenamiento de ${app.packageName} restablecido a cero.`);
                                }}
                                className="px-3 py-2 text-[10px] font-bold bg-white/[0.04] hover:bg-white/[0.08] text-white/70 border border-white/10 rounded-xl transition-all"
                              >
                                Borrar datos
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500 shadow-inner"><Shield size={24} /></div>
                  <div>
                    <h2 className="text-lg font-bold">Compatibilidad con capturas de pantalla</h2>
                    <p className={`text-sm ${t.textMuted} mt-1`}>Prepara una variante de la aplicación para comprobar compatibilidad con capturas. Requiere una aplicación compatible.</p>
                  </div>
                </div>

                <div className={`border ${t.border} rounded-xl p-6 ${t.bg} relative`}>
                  <div className="mb-6">
                    <label className={`block text-sm font-bold mb-2 ${t.text}`}>Nombre del paquete</label>
                    <input
                      type="text"
                      value={patchPackage}
                      onChange={(e) => setPatchPackage(e.target.value)}
                      placeholder="ej. com.badoo.mobile"
                      className={`w-full px-4 py-3 rounded-xl border ${t.border} ${dark ? 'bg-[#0a0c17] text-white focus:border-emerald-500/50' : 'bg-white text-slate-900 focus:border-emerald-500'} outline-none transition-all`}
                    />
                    <label className={`flex items-center gap-3 mt-4 p-3 rounded-xl border ${isCloneMode ? (dark ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-emerald-50 border-emerald-200') : (dark ? 'bg-white/[0.03] border-white/5' : 'bg-slate-50 border-slate-200')} cursor-pointer transition-all`}>
                      <input
                        type="checkbox"
                        checked={isCloneMode}
                        onChange={(e) => setIsCloneMode(e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 text-emerald-500 focus:ring-emerald-500 cursor-pointer"
                      />
                      <div>
                        <span className={`text-sm font-bold ${t.text}`}>Instalar en perfil de trabajo</span>
                        <p className={`text-[10px] ${t.textMuted} mt-0.5`}>Conserva la aplicación original e instala la variante en un perfil de trabajo separado.</p>
                      </div>
                    </label>

                    {!isCloneMode && (
                      <p className={`text-[11px] ${t.textMuted} mt-3`}>
                        ⚠️ <strong>Reemplazo directo:</strong> Se desinstalará la app original. Perderás tus datos locales (cuentas, descargas).
                      </p>
                    )}
                  </div>

                  <button
                    disabled={!patchPackage || isPatching || !device}
                    onClick={startPatching}
                    className={`w-full py-3.5 rounded-xl font-bold transition-all shadow-sm flex items-center justify-center gap-2 ${
                      !patchPackage || isPatching || !device
                        ? 'bg-slate-500/50 text-white/50 cursor-not-allowed'
                        : 'bg-emerald-500 hover:bg-emerald-400 text-white hover:shadow-emerald-500/25'
                    }`}
                  >
                    <Shield size={18} className={isPatching ? 'animate-pulse' : ''} />
                    {isPatching ? 'Procesando aplicación...' : 'Preparar aplicación'}
                  </button>
                </div>

                {patchLogs && (
                  <div className={`mt-6 p-4 rounded-xl border ${t.border} ${dark ? 'bg-black/90' : 'bg-slate-100'}`}>
                    <p className={`text-[10px] ${t.textSub} uppercase tracking-widest font-bold mb-2`}>Registro del proceso</p>
                    <div className={`font-mono text-[11px] h-48 overflow-y-auto whitespace-pre-wrap ${dark ? 'text-emerald-400/80' : 'text-emerald-700'}`}>
                      {patchLogs}
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>

        {/* ── FILE TRANSFER VIEW ── */}
        <div className={`min-w-0 max-w-full flex-1 overflow-x-hidden overflow-y-auto p-4 md:p-6 transition-all duration-200 ${activeNav === 'archivos' ? 'opacity-100 translate-y-0 relative z-0' : 'opacity-0 translate-y-4 absolute inset-0 pointer-events-none'}`}>
          <div className={`mx-auto w-full min-w-0 max-w-4xl ${dark ? 'settings-panel' : `${t.panel} border ${t.border} shadow-sm`} rounded-xl p-8`}>
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 rounded-xl bg-[#1bae6e]/10 flex items-center justify-center text-[#22c97d] shadow-inner"><FolderOpen size={24} /></div>
              <div>
                <h2 className="text-lg font-bold">Transferir archivos</h2>
                <p className={`text-sm ${t.textMuted} mt-1`}>Copia fotos, documentos y vídeos a la carpeta Descargas del dispositivo.</p>
              </div>
            </div>

            <div className={`border-2 border-dashed ${t.dashedBorder} hover:border-[#1bae6e]/50 transition-all duration-200 rounded-xl p-14 flex flex-col items-center justify-center ${t.bg} relative group hover:bg-[#1bae6e]/5`}>
              <input
                type="file"
                multiple
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                onChange={async (e) => {
                  const files = Array.from(e.target.files || []);
                  if (files.length === 0) return;

                  for (const file of files) {
                    addLog(`Transfiriendo ${file.name}...`);
                    setUploadProgress(prev => ({ ...prev, [file.name]: 0 }));

                    const formData = new FormData();
                    formData.append('file', file);
                    formData.append('dest', '/sdcard/Download');
                    if (activeSerial) {
                      formData.append('serial', activeSerial);
                    }

                    await new Promise<void>((resolve) => {
                      const xhr = new XMLHttpRequest();
                      xhr.open('POST', '/api/upload-file');
                      xhr.upload.onprogress = (event) => {
                        if (event.lengthComputable) {
                          const percentComplete = Math.round((event.loaded / event.total) * 100);
                          setUploadProgress(prev => ({ ...prev, [file.name]: percentComplete }));
                        }
                      };
                      xhr.onload = () => {
                        try {
                          const data = JSON.parse(xhr.responseText);
                          addLog(data.success ? `✓ ${data.message}` : `✗ Error: ${data.error}`);
                        } catch {
                          addLog(`✗ Error de red al procesar respuesta de ${file.name}`);
                        }
                        setUploadProgress(prev => {
                          const newProg = { ...prev };
                          delete newProg[file.name];
                          return newProg;
                        });
                        resolve();
                      };
                      xhr.onerror = () => {
                        addLog(`✗ Error de red al subir ${file.name}`);
                        setUploadProgress(prev => {
                          const newProg = { ...prev };
                          delete newProg[file.name];
                          return newProg;
                        });
                        resolve();
                      };
                      xhr.send(formData);
                    });
                  }
                  e.target.value = '';
                }}
              />

              <div className="relative w-full flex flex-col items-center justify-center min-h-[160px]">
                {Object.keys(uploadProgress).length > 0 ? (
                  <div className="w-full flex flex-col items-center z-20 ">
                    <div className="relative w-16 h-16 mb-5">
                      <div className="absolute inset-0 rounded-full bg-[#1bae6e]/20"></div>
                      <div className="relative w-full h-full rounded-full bg-[#1bae6e]/10 flex items-center justify-center text-[#22c97d] bg-white/80 dark:bg-black/80 border border-[#1bae6e]/30 shadow-[0_0_20px_rgba(27,174,110,0.2)]">
                        <Copy size={26} className="animate-pulse" />
                      </div>
                    </div>
                    <div className="w-full max-w-md space-y-4">
                      {Object.entries(uploadProgress).map(([fileName, progress]) => (
                        <div key={fileName} className={`w-full p-4 rounded-xl ${t.cardInner} border ${t.border} shadow-sm backdrop-blur-sm transition-all duration-200`}>
                          <div className="flex justify-between text-sm mb-3 items-center">
                            <span className={`truncate max-w-[80%] font-medium ${dark ? 'text-[#22c97d]' : 'text-emerald-600'}`}>{fileName}</span>
                            <span className={`font-bold ${dark ? 'text-[#22c97d] bg-emerald-500/10' : 'text-emerald-700 bg-emerald-500/20'} px-2 py-0.5 rounded-md`}>
                              {progress}%
                            </span>
                          </div>
                          <div className="w-full h-3 bg-black/10 dark:bg-black/40 rounded-full overflow-hidden shadow-inner relative">
                            <div
                              className="absolute top-0 left-0 h-full bg-emerald-500 transition-all duration-[400ms] ease-out"
                              style={{ width: `${progress}%` }}
                            >
                              <div className="absolute inset-0 bg-white/20 w-full animate-[pulse_2s_infinite]"></div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center transition-all duration-200 ease-in-out opacity-100 scale-100">
                    <div className={`w-20 h-20 rounded-xl ${t.cardInner} group-hover:bg-emerald-500/10 flex items-center justify-center ${t.textSub} group-hover:text-[#22c97d] transition-all duration-200 mb-5 shadow-sm `}>
                      <Copy size={32} className="transition-transform duration-200" />
                    </div>
                    <p className="text-lg font-bold group-hover:text-[#22c97d] transition-colors duration-300">Arrastra archivos aquí</p>
                    <p className={`text-sm ${t.textSub} mt-2 max-w-[250px] text-center transition-colors duration-300`}>
                      Se guardarán en <span className="font-mono bg-black/90 dark:bg-white/[0.05] px-1.5 py-0.5 rounded text-emerald-600 dark:text-[#22c97d]">/sdcard/Download</span>
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ── ADVANCED TOOLS VIEW ── */}
        <div className={`min-w-0 max-w-full flex-1 overflow-x-hidden overflow-y-auto p-4 md:p-6 transition-all duration-200 ${activeNav === 'tools' ? 'opacity-100 translate-y-0 relative z-0' : 'opacity-0 translate-y-4 absolute inset-0 pointer-events-none'}`}>
          <div className={`mx-auto w-full min-w-0 max-w-3xl ${dark ? 'glow-card' : `${t.panel} border ${t.border} shadow-sm`} rounded-xl p-8`}>
            <div className="flex items-center gap-4 mb-8">
              <div className="w-12 h-12 rounded-xl bg-slate-500/10 flex items-center justify-center text-slate-500 shadow-inner"><Wrench size={24} /></div>
              <div>
                <h2 className="text-lg font-bold">Herramientas del dispositivo</h2>
                <p className={`text-sm ${t.textMuted} mt-1`}>Reinicia el dispositivo o accede a modos especiales de recuperación.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <QuickAction dark={dark} icon={<RefreshCw size={20} />} title="Reinicio normal" sub="Reinicia al sistema principal" color="blue" onClick={() => run('reboot', 'Reiniciando dispositivo')} />
              <QuickAction dark={dark} icon={<PowerOff size={20} />} title="Apagado forzado" sub="Apaga el dispositivo de forma segura" color="red" onClick={() => run('power_off', 'Apagando dispositivo')} />
              <QuickAction dark={dark} icon={<Settings size={20} />} title="Modo bootloader" sub="Para fastboot y flasheo" color="amber" onClick={() => run('reboot_bootloader', 'Reiniciando en Bootloader')} />
              <QuickAction dark={dark} icon={<Settings size={20} />} title="Modo recovery" sub="Para rescate y formateo" color="violet" onClick={() => run('reboot_recovery', 'Reiniciando en Recovery')} />
            </div>

            <p className={`text-[10px] ${t.textSub} uppercase tracking-widest font-bold mt-10 mb-5`}>Acciones avanzadas de Fastboot</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <QuickAction dark={dark} icon={<RefreshCw size={20} />} title="Reiniciar desde Fastboot" sub="Volver al sistema Android" color="teal" onClick={() => run('fastboot_reboot', 'Forzando reinicio desde Fastboot')} />
              <QuickAction dark={dark} icon={<Settings size={20} />} title="Abrir recovery" sub="Reiniciar directamente en recovery" color="violet" onClick={() => run('fastboot_reboot_recovery', 'Forzando salto a Recovery')} />
              <QuickAction dark={dark} icon={<PowerOff size={20} />} title="Restablecer datos de fábrica" sub="Borra todos los datos del dispositivo" color="red" onClick={() => { if(confirm('¿Seguro que deseas FORMATEAR COMPLETAMENTE el teléfono de fábrica vía Fastboot?')) run('fastboot_erase', 'Formateando dispositivo de fábrica...'); }} />
            </div>
          </div>
        </div>

        {/* ── ROM FLASHER VIEW ── */}
        <div className={`min-w-0 max-w-full flex-1 overflow-x-hidden overflow-y-auto p-4 md:p-6 transition-all duration-200 ${activeNav === 'flasher' ? 'opacity-100 translate-y-0 relative z-0' : 'opacity-0 translate-y-4 absolute inset-0 pointer-events-none'}`}>
          <div className="mx-auto w-full min-w-0 max-w-4xl space-y-6">

            {/* Header */}
            <div className={`${dark ? 'glow-card' : `${t.panel} border ${t.border} shadow-sm`} rounded-xl p-8`}>
              <div className="flex items-center gap-4 mb-6">
                <div className={`w-14 h-14 rounded-xl ${dark ? 'bg-orange-500/10 border border-orange-500/20' : 'bg-orange-100'} flex items-center justify-center text-orange-500 shadow-inner`}>
                  <Zap size={28} />
                </div>
                <div>
                  <h2 className="text-xl font-bold">Flashear ROM</h2>
                  <p className={`text-sm ${t.textMuted} mt-1`}>Instala sistemas operativos, kernels y particiones vía Fastboot / Sideload.</p>
                </div>
              </div>

              {/* Device State Detector */}
              <div className={`${dark ? 'bg-black/30 border border-white/5' : 'bg-slate-50 border border-slate-200'} rounded-xl p-5 mb-6`}>
                <div className="flex items-center justify-between mb-3">
                  <p className={`text-[10px] ${t.textSub} uppercase tracking-widest font-bold`}>Estado del dispositivo</p>
                  <button
                    onClick={async () => {
                      try {
                        const fd = new FormData();
                        fd.append('action', 'check_state');
                        if (activeSerial) {
                          fd.append('serial', activeSerial);
                        }
                        const r = await fetch('/api/flash', { method: 'POST', body: fd });
                        const d = await r.json();
                        setFlashState(d.state);
                        setFlashInfo(d.deviceInfo || {});
                        addLog(`Estado Flash: ${d.state}`);
                      } catch { addLog('✗ Error al verificar estado'); }
                    }}
                    className={`text-[11px] px-3 py-1.5 rounded-lg ${dark ? 'bg-[#1bae6e]/10 text-[#22c97d] hover:bg-[#1bae6e]/20 border border-[#1bae6e]/20' : 'bg-blue-100 text-blue-600 hover:bg-blue-200'} font-medium flex items-center gap-1.5 transition-all`}
                  >
                    <RefreshCw size={12} /> Detectar
                  </button>
                </div>
                <div className="flex items-center gap-4">
                  <div className={`w-3 h-3 rounded-full ${
                    flashState === 'fastboot' ? 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)]' :
                    flashState === 'adb' ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' :
                    flashState === 'recovery' || flashState === 'sideload' ? 'bg-blue-500 shadow-[0_0_8px_rgba(168,85,247,0.6)]' :
                    flashState === 'hardware_only' ? 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.6)]' :
                    'bg-gray-500'
                  }`} />
                  <div>
                    <p className="text-sm font-bold">
                      {flashState === 'fastboot' ? 'Modo Fastboot — listo para flashear' :
                       flashState === 'adb' ? 'Android activo — reinicia en bootloader para flashear' :
                       flashState === 'recovery' ? '🔧 Modo recovery — Sideload disponible' :
                       flashState === 'sideload' ? 'Modo sideload — listo para recibir el archivo ZIP' :
                       flashState === 'hardware_only' ? 'Hardware detectado — modo de bajo nivel' :
                       'Sin dispositivo detectado'}
                    </p>
                    {flashInfo.product && <p className={`text-xs ${t.textMuted} mt-1`}>Producto: {flashInfo.product} | Serial: {flashInfo.serialno || '--'} | Desbloqueado: {flashInfo.unlocked || '--'}</p>}
                  </div>
                </div>
              </div>

              {flashState === 'hardware_only' && (
                <div className={`flex items-start gap-3 ${dark ? 'bg-amber-500/10 border border-amber-500/20' : 'bg-amber-50 border border-amber-200'} rounded-xl p-4 mb-6`}>
                  <AlertTriangle size={20} className="text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-amber-500">Aviso: Posible falta de Drivers Fastboot</p>
                    <p className={`text-xs ${t.textMuted} mt-1`}>
                      Windows detectó la conexión física del dispositivo, pero no puede comunicarse mediante comandos Fastboot.
                      Si tu celular se reinicia solo a los pocos segundos de entrar en la pantalla de Fastboot, se debe a la falta del driver <strong>Android Bootloader Interface</strong> en tu PC. Instálalo desde el Administrador de Dispositivos para poder flashear.
                    </p>
                  </div>
                </div>
              )}

              {/* Warning */}
              <div className={`flex items-start gap-3 ${dark ? 'bg-red-500/10 border border-red-500/20' : 'bg-red-50 border border-red-200'} rounded-xl p-4 mb-6`}>
                <AlertTriangle size={20} className="text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-red-500">Zona de alto riesgo</p>
                  <p className={`text-xs ${t.textMuted} mt-1`}>Flashear una imagen incorrecta puede dejar tu dispositivo inservible (brick). Asegúrate de que el archivo .img sea compatible con tu modelo exacto.</p>
                </div>
              </div>
            </div>

            {/* Bootloader & Desbloqueo Controls */}
            <div className={`${dark ? 'glow-card' : `${t.panel} border ${t.border} shadow-sm`} rounded-xl p-8`}>
              <div className="flex items-center gap-3 mb-6">
                <Shield size={20} className="text-orange-500" />
                <p className="text-sm font-bold">Bootloader y desbloqueo</p>
              </div>

              {flashState === 'adb' && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center bg-black/10 dark:bg-white/[0.05] p-3 rounded-lg text-xs">
                    <span className={t.textMuted}>Comprobar estado OEM Unlock actual:</span>
                    <button
                      onClick={async () => {
                        try {
                          const fd = new FormData();
                          fd.append('action', 'oem_unlock_check');
                          if (activeSerial) fd.append('serial', activeSerial);
                          const r = await fetch('/api/flash', { method: 'POST', body: fd });
                          const d = await r.json();
                          if (d.success) {
                            addLog(`OEM Unlock: ${d.unlocked ? 'Permitido' : 'Bloqueado'}`);
                            alert(`Desbloqueo OEM en Ajustes está: ${d.unlocked ? 'PERMITIDO / HABILITADO' : 'BLOQUEADO / DESHABILITADO'}`);
                          } else {
                            addLog(`✗ Error al verificar OEM: ${d.error}`);
                          }
                        } catch { addLog('✗ Error de conexión'); }
                      }}
                      className={`px-3 py-1.5 rounded-lg ${dark ? 'bg-[#1bae6e]/10 text-[#22c97d] border border-[#1bae6e]/20' : 'bg-blue-100 text-blue-600'} hover:opacity-80 transition-all font-semibold`}
                    >
                      Verificar Estado OEM
                    </button>
                  </div>

                  <div className="flex gap-3">
                    <button
                      onClick={async () => {
                        if (!confirm('¿Deseas habilitar OEM Unlock a nivel de comandos ADB en el dispositivo? (Deberás ir a Ajustes > Opciones de Desarrollador para activarlo físicamente si no lo está).')) return;
                        try {
                          const fd = new FormData();
                          fd.append('action', 'oem_unlock_enable');
                          if (activeSerial) fd.append('serial', activeSerial);
                          const r = await fetch('/api/flash', { method: 'POST', body: fd });
                          const d = await r.json();
                          addLog(d.success ? `✓ ${d.message}` : `✗ ${d.error}`);
                          alert(d.success ? d.message : d.error);
                        } catch { addLog('✗ Error de conexión'); }
                      }}
                      className="flex-1 py-3 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border border-emerald-500/20 text-xs font-bold transition-all shadow-sm"
                    >
                      Habilitar Desbloqueo OEM
                    </button>

                    <button
                      onClick={async () => {
                        try {
                          const fd = new FormData();
                          fd.append('action', 'reboot_bootloader');
                          if (activeSerial) fd.append('serial', activeSerial);
                          const r = await fetch('/api/flash', { method: 'POST', body: fd });
                          const d = await r.json();
                          addLog(d.success ? `✓ ${d.message}` : `✗ ${d.error}`);
                        } catch { addLog('✗ Error de conexión'); }
                      }}
                      className="flex-1 py-3 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border border-amber-500/20 text-xs font-bold transition-all shadow-sm"
                    >
                      Reiniciar a Bootloader (Fastboot)
                    </button>
                  </div>
                </div>
              )}

              {flashState === 'fastboot' && (
                <div className="space-y-4">
                  <div className="flex gap-3">
                    <button
                      onClick={async () => {
                        if (!confirm('⚠️ ADVERTENCIA: Intentar desbloquear el bootloader formateará tu celular de fábrica por seguridad. ¿Deseas ejecutar "fastboot flashing unlock"?')) return;
                        try {
                          const fd = new FormData();
                          fd.append('action', 'fastboot_unlock');
                          if (activeSerial) fd.append('serial', activeSerial);
                          const r = await fetch('/api/flash', { method: 'POST', body: fd });
                          const d = await r.json();
                          addLog(d.success ? `✓ Desbloqueo: ${d.message}` : `✗ Error: ${d.error}`);
                          alert(d.success ? `Respuesta: ${d.message}` : `Error: ${d.error}`);
                        } catch { addLog('✗ Error de conexión'); }
                      }}
                      className="flex-1 py-3 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/20 text-xs font-bold transition-all shadow-sm"
                    >
                      Desbloquear bootloader
                    </button>

                    <button
                      onClick={async () => {
                        if (!confirm('¿Deseas cerrar el bootloader ejecutando "fastboot flashing lock"? Asegúrate de tener el sistema 100% stock o el celular podría dañarse.')) return;
                        try {
                          const fd = new FormData();
                          fd.append('action', 'fastboot_lock');
                          if (activeSerial) fd.append('serial', activeSerial);
                          const r = await fetch('/api/flash', { method: 'POST', body: fd });
                          const d = await r.json();
                          addLog(d.success ? `✓ Bloqueo: ${d.message}` : `✗ Error: ${d.error}`);
                          alert(d.success ? `Respuesta: ${d.message}` : `Error: ${d.error}`);
                        } catch { addLog('✗ Error de conexión'); }
                      }}
                      className="flex-1 py-3 rounded-xl bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 border border-blue-500/20 text-xs font-bold transition-all shadow-sm"
                    >
                      Bloquear bootloader
                    </button>
                  </div>

                  <button
                    onClick={async () => {
                      try {
                        const fd = new FormData();
                        fd.append('action', 'fastboot_oem_device_info');
                        if (activeSerial) fd.append('serial', activeSerial);
                        const r = await fetch('/api/flash', { method: 'POST', body: fd });
                        const d = await r.json();
                        if (d.success) {
                          addLog('✓ Info de dispositivo obtenida con éxito');
                          alert(d.info);
                        } else {
                          addLog(`✗ Error: ${d.error}`);
                          alert(`Error: ${d.error}`);
                        }
                      } catch { addLog('✗ Error de conexión'); }
                    }}
                    className="w-full py-3 rounded-xl bg-[#1bae6e]/10 hover:bg-[#1bae6e]/20 text-[#22c97d] border border-[#1bae6e]/20 text-xs font-bold transition-all shadow-sm"
                  >
                    Consultar información de seguridad OEM
                  </button>
                </div>
              )}

              {flashState !== 'adb' && flashState !== 'fastboot' && (
                <p className={`text-xs italic ${t.textMuted} text-center py-2`}>
                  Conecta un dispositivo disponible mediante ADB o Fastboot para habilitar estos controles.
                </p>
              )}
            </div>

            {/* Fastboot Flash Panel */}
            <div className={`${dark ? 'glow-card' : `${t.panel} border ${t.border} shadow-sm`} rounded-xl p-8`}>
              <div className="flex items-center gap-3 mb-6">
                <Shield size={20} className="text-orange-500" />
                <p className="text-sm font-bold">Flashear mediante Fastboot (.img)</p>
              </div>

              {/* Partition Selector */}
              <p className={`text-[10px] ${t.textSub} uppercase tracking-widest font-bold mb-3`}>Partición de destino</p>
              <div className="grid grid-cols-6 gap-2 mb-4">
                {PARTITIONS.map(p => (
                  <button key={p.id}
                    onClick={() => setSelectedPartition(p.id)}
                    className={`py-2 px-1 rounded-xl text-center transition-all duration-200 border text-[11px] font-bold ${
                      selectedPartition === p.id
                        ? dark ? 'bg-orange-500/15 border-orange-500/40 text-orange-400 shadow-[0_0_10px_rgba(249,115,22,0.15)]' : 'bg-orange-100 border-orange-300 text-orange-700'
                        : dark ? `bg-white/[0.03] border-white/5 ${t.textMuted} hover:bg-white/10` : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    } ${p.id === 'userdata' ? 'ring-1 ring-red-500/30' : ''}`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {(() => {
                const selectedPartObj = PARTITIONS.find(p => p.id === selectedPartition);
                return selectedPartObj ? (
                  <div className={`mb-6 p-3 rounded-xl flex items-start gap-2.5 text-xs ${dark ? 'bg-orange-500/5 border border-orange-500/10 text-orange-300/80' : 'bg-orange-50 border border-orange-200 text-orange-800'}`}>
                    <AlertTriangle size={14} className="shrink-0 mt-0.5 text-orange-500" />
                    <div>
                      <span className="font-bold uppercase tracking-wider text-[10px] block mb-0.5">Destino: {selectedPartObj.label}</span>
                      <p className="opacity-90">{selectedPartObj.desc}</p>
                    </div>
                  </div>
                ) : null;
              })()}

              {/* File Drop */}
              <div className={`border-2 border-dashed ${dark ? 'border-orange-500/20 hover:border-orange-500/50' : 'border-orange-300 hover:border-orange-500'} transition-all duration-200 rounded-xl p-10 flex flex-col items-center justify-center ${t.bg} relative group hover:bg-orange-500/5`}>
                <input
                  type="file"
                  accept=".img,.bin,.mbn"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) { setFlashFile(f); addLog(`Archivo seleccionado: ${f.name} (${(f.size / 1024 / 1024).toFixed(1)} MB)`); }
                  }}
                />
                <div className={`w-14 h-14 rounded-full ${dark ? 'bg-orange-500/10' : 'bg-orange-100'} flex items-center justify-center text-orange-500 mb-4 transition-transform`}>
                  <Download size={26} />
                </div>
                {flashFile ? (
                  <>
                    <p className="text-sm font-bold text-orange-500">{flashFile.name}</p>
                    <p className={`text-xs ${t.textMuted} mt-1`}>{(flashFile.size / 1024 / 1024).toFixed(1)} MB — Partición destino: <span className="font-bold text-orange-400">{selectedPartition}</span></p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-bold group-hover:text-orange-500 transition-colors">Arrastre el archivo .img aquí</p>
                    <p className={`text-xs ${t.textMuted} mt-1`}>boot.img, recovery.img, system.img, etc.</p>
                  </>
                )}
              </div>

              {/* Flash Button */}
              <button
                disabled={!flashFile || flashState !== 'fastboot' || flashing}
                onClick={async () => {
                  if (!flashFile) return;
                  // CORREGIDO: doble confirmación para particiones críticas
                  const selectedPartObj = PARTITIONS.find(p => p.id === selectedPartition);
                  const isCritical = selectedPartObj?.critical === true;
                  if (!confirm(`¿Estás SEGURO de flashear "${flashFile.name}" en la partición "${selectedPartition}"? Esto podría dañar el dispositivo.`)) return;
                  if (isCritical) {
                    if (!confirm(`⚠ ADVERTENCIA CRÍTICA ⚠\n\n"${selectedPartition}" es una partición de bajo nivel.\n\nFlashearla incorrectamente puede:\n• Dejar el dispositivo inservible (brick)\n• Borrar el IMEI permanentemente\n• Dañar la calibración de sensores\n\n¿Confirmas que sabes lo que haces?`)) return;
                    addLog(`⚠ Flasheando partición CRÍTICA: ${selectedPartition}`);
                  }
                  setFlashing(true);
                  setFlashProgress('Enviando imagen al dispositivo...');
                  addLog(`Flasheando ${flashFile.name} → ${selectedPartition}...`);
                  try {
                    const fd = new FormData();
                    fd.append('action', 'flash');
                    fd.append('file', flashFile);
                    fd.append('partition', selectedPartition);
                    if (isCritical) fd.append('confirmCritical', 'true');
                    if (activeSerial) {
                      fd.append('serial', activeSerial);
                    }
                    const r = await fetch('/api/flash', { method: 'POST', body: fd });
                    const d = await r.json();
                    addLog(d.success ? `✓ ${d.message}` : `✗ ${d.error}`);
                    setFlashProgress(d.success ? '✓ Flash completado' : `✗ ${d.error}`);
                  } catch { addLog('✗ Error de conexión'); setFlashProgress('✗ Error'); }
                  finally { setFlashing(false); }
                }}
                className={`mt-5 w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all duration-200 ${
                  flashing ? 'bg-orange-500/20 text-orange-300 cursor-wait' :
                  !flashFile || flashState !== 'fastboot' ? `${dark ? 'bg-white/[0.04] text-white/20' : 'bg-slate-100 text-slate-400'} cursor-not-allowed` :
                  dark ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-orange-600 text-white hover:bg-orange-500 shadow-sm'
                }`}
              >
                {flashing ? <><RefreshCw size={16} className="animate-spin" /> {flashProgress}</> : <><Zap size={16} /> FLASHEAR PARTICIÓN</>}
              </button>
              {flashState !== 'fastboot' && flashFile && (
                <p className={`text-xs text-center ${t.textMuted} mt-2`}>⚠️ Requiere que el dispositivo esté en modo Fastboot. Usa el botón &quot;Detectar&quot; de la parte superior.</p>
              )}
            </div>

            {/* Sideload Panel */}
            <div className={`${dark ? 'bg-white/[0.025] border border-white/[0.07]' : `${t.panel} border ${t.border} shadow-sm`} rounded-xl p-8`}>
              <div className="flex items-center gap-3 mb-6">
                <Download size={20} className="text-blue-500" />
                <p className="text-sm font-bold">ADB Sideload (.zip)</p>
                <span className={`text-[10px] px-2 py-0.5 rounded-full ${dark ? 'bg-blue-500/15 text-blue-400 border border-blue-500/30' : 'bg-blue-100 text-blue-600'} font-medium`}>Recovery</span>
              </div>
              <p className={`text-xs ${t.textMuted} mb-5`}>Envía un archivo ZIP de Custom ROM o actualización al modo Recovery (TWRP/LineageOS Recovery). El dispositivo debe estar en modo ADB Sideload.</p>

              <div className={`border-2 border-dashed ${dark ? 'border-blue-500/20 hover:border-blue-500/50' : 'border-blue-300 hover:border-blue-500'} transition-all duration-200 rounded-xl p-10 flex flex-col items-center justify-center ${t.bg} relative group hover:bg-blue-500/5`}>
                <input
                  type="file"
                  accept=".zip"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    if (!confirm(`¿Enviar "${f.name}" vía ADB Sideload?`)) return;
                    // CORREGIDO: verificar que el dispositivo esté en modo sideload
                    if (flashState !== 'sideload' && flashState !== 'recovery') {
                      addLog(`✗ El dispositivo debe estar en modo Recovery/Sideload. Actual: ${flashState}`);
                      setFlashProgress('✗ Requiere modo Recovery con ADB Sideload activado');
                      // Re-detectar automáticamente
                      try {
                        const fd2 = new FormData();
                        fd2.append('action', 'check_state');
                        if (activeSerial) fd2.append('serial', activeSerial);
                        const r2 = await fetch('/api/flash', { method: 'POST', body: fd2 });
                        const d2 = await r2.json();
                        setFlashState(d2.state);
                        setFlashInfo(d2.deviceInfo || {});
                      } catch (e) { console.error('[Flash] unlock request error:', e); }
                      return;
                    }
                    setFlashing(true);
                    setFlashProgress('Enviando ZIP por sideload...');
                    addLog(`Sideload: ${f.name} (${(f.size / 1024 / 1024).toFixed(1)} MB)...`);
                    try {
                      const fd = new FormData();
                      fd.append('action', 'sideload');
                      fd.append('file', f);
                      if (activeSerial) {
                        fd.append('serial', activeSerial);
                      }
                      const r = await fetch('/api/flash', { method: 'POST', body: fd });
                      const d = await r.json();
                      addLog(d.success ? `✓ ${d.message}` : `✗ ${d.error}`);
                      setFlashProgress(d.success ? '✓ Sideload completo' : `✗ ${d.error}`);
                    } catch { addLog('✗ Error de conexión'); }
                    finally { setFlashing(false); e.target.value = ''; }
                  }}
                />
                <div className={`w-14 h-14 rounded-full ${dark ? 'bg-blue-500/10' : 'bg-blue-100'} flex items-center justify-center text-blue-500 mb-4 transition-transform`}>
                  <Download size={26} />
                </div>
                <p className="text-sm font-semibold group-hover:text-emerald-500 transition-colors">Suelta un archivo ZIP de ROM</p>
                <p className={`text-xs ${t.textMuted} mt-1`}>lineage-20.0-xxx.zip, twrp-installer.zip, etc.</p>
              </div>
            </div>

            {/* Quick Help */}
            <div className={`${dark ? 'bg-white/[0.03] border border-white/[0.07]' : 'bg-slate-50 border border-slate-200'} rounded-xl p-6`}>
              <p className={`text-[10px] ${t.textSub} uppercase tracking-widest font-bold mb-4`}>Guía rápida</p>
              <div className={`space-y-3 text-xs ${t.textMuted}`}>
                <p><span className="font-bold text-orange-500">1.</span> Conecta tu dispositivo por <span className="font-bold">USB</span>.</p>
                <p><span className="font-bold text-orange-500">2.</span> Desde &quot;Herramientas&quot; selecciona <span className="font-bold">&quot;Modo bootloader&quot;</span> o usa <code className={`px-1.5 py-0.5 rounded ${dark ? 'bg-white/10' : 'bg-slate-200'}`}>adb reboot bootloader</code>.</p>
                <p><span className="font-bold text-orange-500">3.</span> Selecciona <span className="font-bold">&quot;Detectar&quot;</span> hasta que aparezca <span className="text-orange-500 font-bold">&quot;Modo Fastboot&quot;</span>.</p>
                <p><span className="font-bold text-orange-500">4.</span> Selecciona la <span className="font-bold">partición destino</span>, arrastra tu <code className={`px-1.5 py-0.5 rounded ${dark ? 'bg-white/10' : 'bg-slate-200'}`}>.img</code> y presiona <span className="font-bold text-orange-500">FLASHEAR</span>.</p>
                <p><span className="font-bold text-blue-500">Sideload:</span> Para Custom ROMs (.zip), entra a <span className="font-bold">Recovery → Apply update → ADB Sideload</span> y arrastra el ZIP.</p>
              </div>
            </div>
          </div>
        </div>

        {/* ── OPTIMIZER VIEW ── */}
        <div className={`min-w-0 max-w-full flex-1 overflow-x-hidden overflow-y-auto p-4 md:p-6 transition-all duration-200 ${activeNav === 'optimizar' ? 'opacity-100 translate-y-0 relative z-0' : 'opacity-0 translate-y-4 absolute inset-0 pointer-events-none'}`}>
          <div className="mx-auto w-full min-w-0 max-w-5xl space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className={`text-[10px] uppercase tracking-[0.18em] font-bold ${t.textSub}`}>Dispositivo Android</p>
                <h2 className={`mt-1 text-2xl font-bold tracking-tight ${t.text}`}>Optimización</h2>
                <p className={`mt-1 max-w-2xl text-xs leading-relaxed ${t.textMuted}`}>Ajusta rendimiento, pantalla y conectividad. Los cambios se aplican directamente al dispositivo conectado.</p>
              </div>
              <span className={`inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold ${device?.connected ? dark ? 'border-[#1bae6e]/25 bg-[#1bae6e]/10 text-[#34d399]' : 'border-emerald-200 bg-emerald-50 text-emerald-700' : dark ? 'border-white/10 bg-white/[0.03] text-white/45' : 'border-slate-200 bg-slate-50 text-slate-500'}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${device?.connected ? 'bg-[#22c97d]' : 'bg-slate-400'}`} />
                {device?.connected ? device.model || 'Dispositivo conectado' : 'Sin dispositivo'}
              </span>
            </div>
            {/* Sub-tabs */}
            <div className="custom-scrollbar flex gap-2 overflow-x-auto pb-2">
              {[
                { id: 'performance', label: 'Rendimiento', icon: Cpu },
                { id: 'audio', label: 'Audio', icon: Volume2 },
                { id: 'network', label: 'Red', icon: Wifi },
                { id: 'notifications', label: 'Notificaciones', icon: Bell },
                { id: 'diagnostics', label: 'Diagnóstico', icon: Search },
              ].map(t => (
                <button key={t.id} onClick={() => setOptimizerTab(t.id as 'performance' | 'audio' | 'network' | 'diagnostics' | 'notifications')}
                  className={`flex shrink-0 items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all border ${
                    optimizerTab === t.id
                      ? dark ? 'bg-[#1bae6e]/15 border-[#1bae6e]/30 text-[#22c97d]' : 'bg-emerald-100 border-emerald-300 text-emerald-700'
                      : dark ? 'bg-white/[0.03] border-white/5 text-white/40 hover:text-white' : 'bg-slate-50 border-slate-200 text-slate-500 hover:text-slate-700'
                  }`}>
                  <t.icon size={14} />{t.label}
                </button>
              ))}
            </div>

            {/* ═══════════════════════ RENDIMIENTO ═══════════════════════ */}
            {optimizerTab === 'performance' && (
              <div className="space-y-6">
                {/* Animation Speed */}
                <div className={`${dark ? 'settings-panel' : `${t.panel} border ${t.border} shadow-sm`} rounded-xl p-6`}>
                  <p className={`text-[10px] ${t.textSub} uppercase tracking-widest font-bold mb-4`}>Velocidad de Animaciones</p>
                  <div className="space-y-4">
                    {[
                      { key: 'window_animation_scale', label: 'Transiciones de ventana' },
                      { key: 'transition_animation_scale', label: 'Transiciones de actividad' },
                      { key: 'animator_duration_scale', label: 'Duración del animador' },
                    ].map(({ key, label }) => (
                      <div key={key}>
                        <div className="flex justify-between text-xs mb-2">
                          <span className={t.textMuted}>{label}</span>
                          <span className="text-[#22c97d] font-bold">{animScales[key] || '1.0'}x</span>
                        </div>
                        <input type="range" min="0" max="10" step="0.5"
                          value={isNaN(parseFloat(animScales[key])) ? 2 : parseFloat(animScales[key]) * 2}
                          onChange={e => {
                            const raw = parseFloat(e.target.value);
                            const v = isNaN(raw) ? '1.0' : (raw / 2).toFixed(1);
                            setAnimScales(s => ({...s, [key]: v}));
                          }}
                          onMouseUp={async e => {
                            const raw = parseFloat((e.target as HTMLInputElement).value);
                            const v = isNaN(raw) ? '1.0' : (raw / 2).toFixed(1);
                            await run('set_animation_scale', '', { type: key.replace('_animation_scale',''), value: v }, false);
                            addLog(`Animación ${label}: ${v}x`);
                          }}
                          className="w-full h-2 rounded-full appearance-none cursor-pointer bg-white/10 accent-[#1bae6e]" />
                      </div>
                    ))}
                    <div className="flex gap-2 pt-2">
                      <button onClick={async () => {
                        const s = {window_animation_scale:'1.0', transition_animation_scale:'1.0', animator_duration_scale:'1.0'};
                        setAnimScales(s);
                        await run('set_animation_batch', '', { scales: s }, false);
                        addLog('Animaciones restablecidas a 1x');
                      }} className={`px-3 py-1.5 text-[10px] rounded-lg border ${dark?'border-white/10 text-white/40 hover:text-white':'border-slate-200 text-slate-500'} transition-all`}>Restablecer (1x)</button>
                      <button onClick={async () => {
                        const s = {window_animation_scale:'0.5', transition_animation_scale:'0.5', animator_duration_scale:'0.5'};
                        setAnimScales(s);
                        await run('set_animation_batch', '', { scales: s }, false);
                        addLog('Animaciones: modo rápido 0.5x');
                      }} className={`px-3 py-1.5 text-[10px] rounded-lg border ${dark?'border-[#1bae6e]/20 text-[#22c97d] hover:bg-[#1bae6e]/10':'border-blue-200 text-blue-600 hover:bg-blue-50'} transition-all`}>Rápido (0.5x)</button>
                      <button onClick={async () => {
                        const s = {window_animation_scale:'0', transition_animation_scale:'0', animator_duration_scale:'0'};
                        setAnimScales(s);
                        await run('set_animation_batch', '', { scales: s }, false);
                        addLog('Animaciones: modo instantáneo');
                      }} className={`px-3 py-1.5 text-[10px] rounded-lg border ${dark?'border-green-500/20 text-green-400 hover:bg-green-500/10':'border-green-200 text-green-600 hover:bg-green-50'} transition-all`}>Instantáneo (0x)</button>
                    </div>
                  </div>
                </div>

                {/* DPI */}
                <div className={`${dark ? 'settings-panel' : `${t.panel} border ${t.border} shadow-sm`} rounded-xl p-6`}>
                  <p className={`text-[10px] ${t.textSub} uppercase tracking-widest font-bold mb-4`}>Densidad de Pantalla (DPI)</p>
                  <div className="flex items-center gap-4">
                    <input type="range" min="200" max="600" step="10" value={isNaN(currentDpi) ? 420 : currentDpi}
                      onChange={e => setCurrentDpi(parseInt(e.target.value) || 420)}
                      onMouseUp={async e => { const v = parseInt((e.target as HTMLInputElement).value); await run('set_dpi', '', { dpi: v }, false); addLog(`DPI ajustado a ${v}`); }}
                      className="flex-1 h-2 rounded-full appearance-none cursor-pointer bg-white/10 accent-blue-500" />
                    <span className="text-sm font-bold text-blue-400 w-12 text-right">{currentDpi}</span>
                    <button onClick={async () => { await run('set_dpi', '', { dpi: 420 }, false); setCurrentDpi(420); addLog('DPI restablecido a 420 (valor predeterminado)'); }}
                      className={`px-3 py-1.5 text-[10px] rounded-lg border ${dark?'border-white/10 text-white/40 hover:text-white':'border-slate-200 text-slate-500'} transition-all`}>Restablecer</button>
                  </div>
                </div>

                {/* GPU */}
                <div className={`${dark ? 'settings-panel' : `${t.panel} border ${t.border} shadow-sm`} rounded-xl p-6`}>
                  <p className={`text-[10px] ${t.textSub} uppercase tracking-widest font-bold mb-4`}>GPU y renderizado</p>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { key: 'force_gpu' as const, label: 'Forzar GPU (Vulkan)', desc: 'Skia Vulkan en vez de OpenGL' },
                      { key: 'disable_overlays' as const, label: 'Desactivar HW Overlays', desc: 'GPU maneja la composición' },
                      { key: 'force_msaa' as const, label: 'Forzar 4x MSAA', desc: 'Antialiasing en apps OpenGL' },
                    ].map(({ key, label, desc }) => {
                      const isActive = gpuTweaks[key];
                      return (
                        <button key={key} onClick={async () => {
                          const reset = isActive;
                          const v = key === 'force_gpu' ? 'skiavk' : key === 'force_msaa' ? '4' : 'true';
                          setGpuTweaks(prev => ({ ...prev, [key]: !isActive }));
                          await run('set_gpu_tweak', '', { key, value: v, reset }, false);
                          addLog(`GPU: ${label} ${reset ? 'desactivado' : 'activado'}`);
                        }}
                        className={`p-4 rounded-xl text-left transition-all border ${
                          isActive
                            ? dark
                              ? 'bg-[#1bae6e]/15 border-[#1bae6e]/40 text-[#34d399] shadow-[0_0_15px_rgba(27,174,110,0.15)]'
                              : 'bg-blue-100 border-blue-400 text-blue-800'
                            : dark
                              ? 'bg-white/[0.03] border-white/5 text-white/50 hover:text-white hover:bg-white/10'
                              : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                        }`}>
                          <div className="flex justify-between items-center mb-1">
                            <p className="text-xs font-bold">{label}</p>
                            <span className={`w-2 h-2 rounded-full ${isActive ? 'bg-[#22c97d]' : 'bg-white/20'}`}></span>
                          </div>
                          <p className={`text-[10px] ${isActive ? (dark ? 'text-[#22c97d]/70' : 'text-blue-600') : t.textMuted}`}>{desc}</p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Background Process Limit */}
                <div className={`${dark ? 'settings-panel' : `${t.panel} border ${t.border} shadow-sm`} rounded-xl p-6`}>
                  <p className={`text-[10px] ${t.textSub} uppercase tracking-widest font-bold mb-4`}>Límite de Procesos en Segundo Plano</p>
                  <div className="flex flex-wrap gap-2">
                    {[{v:'standard',l:'Estándar'},{v:'4',l:'Máx 4 apps'},{v:'3',l:'Máx 3 apps'},{v:'2',l:'Máx 2 apps'},{v:'1',l:'1 app'}].map(({v,l}) => {
                      const isActive = backgroundLimit === v;
                      return (
                        <button key={v} onClick={async () => {
                          setBackgroundLimit(v);
                          await run('set_background_limit', '', { limit: v }, false);
                          addLog(`Límite de procesos: ${l}`);
                        }}
                        className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                          isActive
                            ? dark
                              ? 'bg-[#1bae6e]/20 border-[#1bae6e]/40 text-[#22c97d] shadow-sm'
                              : 'bg-blue-600 border-blue-600 text-white'
                            : dark
                              ? 'bg-white/[0.03] border-white/10 hover:bg-[#1bae6e]/10 hover:border-[#1bae6e]/20 text-white/60 hover:text-white'
                              : 'bg-slate-50 border-slate-200 hover:bg-blue-50 text-slate-600'
                        }`}>{l}</button>
                      );
                    })}
                  </div>
                </div>

                {/* ── Display ── */}
                <p className={`text-[9px] ${t.textSub} uppercase tracking-[0.2em] font-bold pt-2`}>Pantalla</p>

                {/* Screen Timeout */}
                <div className={`${dark ? 'settings-panel' : `${t.panel} border ${t.border} shadow-sm`} rounded-xl p-5`}>
                  <p className={`text-[10px] ${t.textMuted} font-bold mb-3`}>Tiempo de Apagado de Pantalla</p>
                  <div className="flex flex-wrap gap-2">
                    {[{v:15000,l:'15s'},{v:30000,l:'30s'},{v:60000,l:'1 min'},{v:120000,l:'2 min'},{v:300000,l:'5 min'},{v:600000,l:'10 min'},{v:1800000,l:'30 min'}].map(({v,l}) => {
                      const isActive = screenTimeout === String(v);
                      return (
                        <button key={v} onClick={async () => {
                          setScreenTimeout(String(v));
                          await run('set_screen_timeout', '', { timeout: v }, false);
                          addLog(`Timeout pantalla: ${l}`);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${
                          isActive
                            ? dark
                              ? 'bg-[#1bae6e]/20 border-[#1bae6e]/40 text-[#34d399]'
                              : 'bg-blue-600 border-blue-600 text-white'
                            : dark
                              ? 'bg-white/[0.03] border-white/10 hover:bg-[#1bae6e]/10 text-white/60'
                              : 'bg-slate-50 border-slate-200 hover:bg-blue-50 text-slate-600'
                        }`}>{l}</button>
                      );
                    })}
                  </div>
                </div>

                {/* Peak Refresh + Night Mode */}
                <div className="grid grid-cols-2 gap-4">
                  <div className={`${dark ? 'settings-panel' : `${t.panel} border ${t.border} shadow-sm`} rounded-xl p-5`}>
                    <p className={`text-[10px] ${t.textMuted} font-bold mb-3`}>Frecuencia de Actualización</p>
                    <div className="flex flex-wrap gap-2">
                      {[{v:60,l:'60 Hz'},{v:90,l:'90 Hz'},{v:120,l:'120 Hz'}].map(({v,l}) => {
                        const isActive = peakRefreshRate === String(v);
                        return (
                          <button key={v} onClick={async () => {
                            setPeakRefreshRate(String(v));
                            await run('set_peak_refresh', '', { hz: v }, false);
                            addLog(`Refresh: ${l}`);
                          }}
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${
                            isActive
                              ? dark
                                ? 'bg-[#1bae6e]/20 border-[#1bae6e]/40 text-[#34d399]'
                                : 'bg-blue-600 border-blue-600 text-white'
                              : dark
                                ? 'bg-white/[0.03] border-white/10 hover:bg-[#1bae6e]/10 text-white/60'
                                : 'bg-slate-50 border-slate-200 hover:bg-blue-50 text-slate-600'
                          }`}>{l}</button>
                        );
                      })}
                    </div>
                  </div>
                  <div className={`${dark ? 'settings-panel' : `${t.panel} border ${t.border} shadow-sm`} rounded-xl p-5`}>
                    <p className={`text-[10px] ${t.textMuted} font-bold mb-3`}>Modo Noche / Tema Oscuro</p>
                    <div className="flex flex-wrap gap-2">
                      {[{v:1,l:'Activado'},{v:2,l:'Automático'},{v:0,l:'Desactivado'}].map(({v,l}) => {
                        const isActive = nightMode === String(v);
                        return (
                          <button key={v} onClick={async () => {
                            setNightMode(String(v));
                            await run('set_night_mode', '', { mode: v }, false);
                            addLog(`Modo noche: ${l}`);
                          }}
                          className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${
                            isActive
                              ? dark
                                ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
                                : 'bg-blue-600 border-blue-600 text-white'
                              : dark
                                ? 'bg-white/[0.03] border-white/10 hover:bg-blue-500/10 text-white/60'
                                : 'bg-slate-50 border-slate-200 hover:bg-blue-50 text-slate-600'
                          }`}>{l}</button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* ── Herramientas de Desarrollo ── */}
                <p className={`text-[9px] ${t.textSub} uppercase tracking-[0.2em] font-bold pt-2`}>Opciones avanzadas</p>
                <div className={`${dark ? 'settings-panel' : `${t.panel} border ${t.border} shadow-sm`} rounded-xl p-5`}>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { isActive: autoBrightness,  setState: setAutoBrightness,  targetValue: true,  act:'set_auto_brightness', enabled: true,  label:'Brillo automático',             desc:'Brillo adaptativo' },
                      { isActive: !autoBrightness, setState: setAutoBrightness,  targetValue: false, act:'set_auto_brightness', enabled: false, label:'Brillo manual',            desc:'Brillo manual fijo' },
                      { isActive: stayAwake,        setState: setStayAwake,       targetValue: true,  act:'set_stay_awake',      enabled: true,  label:'Pantalla Siempre Encendida', desc:'Mientras carga (USB+AC)' },
                      { isActive: !stayAwake,       setState: setStayAwake,       targetValue: false, act:'set_stay_awake',      enabled: false, label:'Pantalla Normal',            desc:'Se apaga según timeout' },
                      { isActive: demoMode,         setState: setDemoMode,        targetValue: true,  act:'set_demo_mode',       enabled: true,  label:'Modo Demo',                  desc:'Batería 100%, sin notificaciones' },
                      { isActive: !demoMode,        setState: setDemoMode,        targetValue: false, act:'set_demo_mode',       enabled: false, label:'Modo normal',              desc:'Restaurar estado normal' },
                      { isActive: showTouches,      setState: setShowTouches,     targetValue: true,  act:'set_show_touches',    enabled: true,  label:'Mostrar Toques',             desc:'Indicador visual de taps' },
                      { isActive: !showTouches,     setState: setShowTouches,     targetValue: false, act:'set_show_touches',    enabled: false, label:'Ocultar Toques',             desc:'Desactivar indicador' },
                    ].map(({ isActive, setState, targetValue, act, enabled, label, desc }) => (
                      <button key={act+String(enabled)} onClick={async () => {
                        setState(targetValue);
                        await run(act, '', { enabled }, false);
                        addLog(`${label}`);
                      }}
                      className={`p-3 rounded-xl text-left transition-all border text-xs ${
                        isActive
                          ? dark
                            ? 'bg-[#1bae6e]/15 border-[#1bae6e]/40 text-[#34d399]'
                            : 'bg-blue-100 border-blue-400 text-blue-800 font-bold'
                          : dark
                            ? 'bg-white/[0.03] border-white/5 text-white/50 hover:bg-[#1bae6e]/10'
                            : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-blue-50'
                      }`}>
                        <div className="flex justify-between items-center">
                          <p className="font-bold">{label}</p>
                          {isActive && <span className="w-1.5 h-1.5 rounded-full bg-[#22c97d]"></span>}
                        </div>
                        <p className={`text-[10px] ${isActive ? (dark ? 'text-[#22c97d]/70' : 'text-blue-600') : t.textMuted} mt-0.5`}>{desc}</p>
                      </button>
                    ))}

                  </div>
                </div>
              </div>
            )}

            {/* ═══════════════════════ AUDIO ═══════════════════════ */}
            {optimizerTab === 'audio' && (
              <div className="space-y-6">
                {/* Bluetooth Codec */}
                <div className={`${dark ? 'glow-card' : `${t.panel} border ${t.border} shadow-sm`} rounded-xl p-6`}>
                  <p className={`text-[10px] ${t.textSub} uppercase tracking-widest font-bold mb-4`}>Codec Bluetooth A2DP</p>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {[
                      { v:'0', l:'SBC', desc:'Estándar, 328kbps' },
                      { v:'1', l:'AAC', desc:'Apple, 256kbps' },
                      { v:'2', l:'aptX', desc:'Qualcomm, 384kbps' },
                      { v:'3', l:'aptX HD', desc:'Qualcomm, 576kbps' },
                      { v:'4', l:'LDAC', desc:'Sony, 990kbps' },
                      { v:'5', l:'LHDC', desc:'HWA, 900kbps' },
                    ].map(({v,l,desc}) => {
                      const isActive = bluetoothInfo.bluetooth_a2dp_codec_selection === v;
                      const codecCode = ['sbc','aac','aptx','aptx_hd','ldac','lhdc'][parseInt(v)];
                      return (
                        <button key={v} onClick={async () => {
                          setBluetoothInfo(prev => ({ ...prev, bluetooth_a2dp_codec_selection: v }));
                          await run('set_bluetooth_codec', '', { codec: codecCode, sampleRate: null, bitsPerSample: null, ldacQuality: null }, false);
                          addLog(`Codec: ${l}`);
                        }}
                        className={`px-3 py-2 rounded-xl text-xs text-left transition-all border ${
                          isActive
                            ? dark
                              ? 'bg-blue-500/20 border-blue-500/40 text-blue-300 font-bold'
                              : 'bg-blue-600 border-blue-600 text-white'
                            : dark
                              ? 'bg-white/[0.03] border-white/10 hover:bg-blue-500/10'
                              : 'bg-slate-50 border-slate-200 hover:bg-blue-50 text-slate-600'
                        }`}>
                          <p className="font-bold">{l}</p><p className={`text-[10px] ${isActive ? (dark ? 'text-blue-200/70' : 'text-blue-100') : t.textMuted}`}>{desc}</p>
                        </button>
                      );
                    })}
                  </div>
                  {/* Sample Rate */}
                  <p className={`text-[10px] ${t.textMuted} mb-2`}>Sample Rate</p>
                  <div className="flex gap-2 mb-4">
                    {['44100','48000','96000'].map(r => {
                      const isActive = bluetoothInfo.bluetooth_a2dp_sample_rate_selection === r;
                      return (
                        <button key={r} onClick={async () => {
                          setBluetoothInfo(prev => ({ ...prev, bluetooth_a2dp_sample_rate_selection: r }));
                          await run('set_bluetooth_codec', '', { codec: null, sampleRate: r, bitsPerSample: null, ldacQuality: null }, false);
                          addLog(`Sample rate: ${r}Hz`);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${
                          isActive
                            ? dark
                              ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
                              : 'bg-blue-600 border-blue-600 text-white'
                            : dark
                              ? 'bg-white/[0.03] border-white/10 hover:bg-blue-500/10 text-white/60'
                              : 'bg-slate-50 border-slate-200 hover:bg-blue-50 text-slate-600'
                        }`}>{parseInt(r)/1000} kHz</button>
                      );
                    })}
                  </div>
                  {/* Bits per Sample */}
                  <p className={`text-[10px] ${t.textMuted} mb-2`}>Bits por Sample</p>
                  <div className="flex gap-2 mb-4">
                    {['16','24','32'].map(b => {
                      const isActive = bluetoothInfo.bluetooth_a2dp_bits_per_sample_selection === b;
                      return (
                        <button key={b} onClick={async () => {
                          setBluetoothInfo(prev => ({ ...prev, bluetooth_a2dp_bits_per_sample_selection: b }));
                          await run('set_bluetooth_codec', '', { codec: null, sampleRate: null, bitsPerSample: b, ldacQuality: null }, false);
                          addLog(`Bits: ${b}`);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${
                          isActive
                            ? dark
                              ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
                              : 'bg-blue-600 border-blue-600 text-white'
                            : dark
                              ? 'bg-white/[0.03] border-white/10 hover:bg-blue-500/10 text-white/60'
                              : 'bg-slate-50 border-slate-200 hover:bg-blue-50 text-slate-600'
                        }`}>{b} bit</button>
                      );
                    })}
                  </div>
                  {/* LDAC Quality */}
                  <p className={`text-[10px] ${t.textMuted} mb-2`}>Calidad LDAC (kbps)</p>
                  <div className="flex gap-2">
                    {[{v:'0',l:'330'},{v:'1',l:'660'},{v:'2',l:'990'}].map(q => {
                      const isActive = bluetoothInfo.bluetooth_a2dp_ldac_playback_quality === q.v;
                      return (
                        <button key={q.v} onClick={async () => {
                          setBluetoothInfo(prev => ({ ...prev, bluetooth_a2dp_ldac_playback_quality: q.v }));
                          await run('set_bluetooth_codec', '', { codec: 'ldac', sampleRate: null, bitsPerSample: null, ldacQuality: q.v }, false);
                          addLog(`LDAC: ${q.l} kbps`);
                        }}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${
                          isActive
                            ? dark
                              ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
                              : 'bg-blue-600 border-blue-600 text-white'
                            : dark
                              ? 'bg-white/[0.03] border-white/10 hover:bg-blue-500/10 text-white/60'
                              : 'bg-slate-50 border-slate-200 hover:bg-blue-50 text-slate-600'
                        }`}>{q.l}</button>
                      );
                    })}
                  </div>
                </div>
                {/* Absolute Volume */}
                <div className={`${dark ? 'glow-card' : `${t.panel} border ${t.border} shadow-sm`} rounded-xl p-6`}>
                  <p className={`text-[10px] ${t.textSub} uppercase tracking-widest font-bold mb-3`}>Volumen Absoluto Bluetooth</p>
                  <div className="flex gap-2">
                    {(() => {
                      const isDisabled = bluetoothInfo.bluetooth_disable_absolute_volume === '1';
                      return (
                        <>
                          <button onClick={async () => {
                            setBluetoothInfo(prev => ({ ...prev, bluetooth_disable_absolute_volume: '0' }));
                            await run('set_bluetooth_absolute_volume', '', { disable: '0' }, false);
                            addLog('Volumen Absoluto: Habilitado');
                          }}
                          className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                            !isDisabled
                              ? dark
                                ? 'bg-green-500/20 border-green-500/40 text-green-400 shadow-sm'
                                : 'bg-green-600 border-green-600 text-white'
                              : dark
                                ? 'bg-white/[0.03] border-white/10 hover:bg-white/10 text-white/60'
                                : 'bg-slate-50 border-slate-200 text-slate-500'
                          }`}>Habilitado (Recomendado)</button>
                          <button onClick={async () => {
                            setBluetoothInfo(prev => ({ ...prev, bluetooth_disable_absolute_volume: '1' }));
                            await run('set_bluetooth_absolute_volume', '', { disable: '1' }, false);
                            addLog('Volumen Absoluto: Deshabilitado');
                          }}
                          className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                            isDisabled
                              ? dark
                                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300 shadow-sm'
                                : 'bg-amber-600 border-amber-600 text-white'
                              : dark
                                ? 'bg-white/[0.03] border-white/10 hover:bg-white/10 text-white/60'
                                : 'bg-slate-50 border-slate-200 text-slate-500'
                          }`}>Deshabilitado (Más volumen)</button>
                        </>
                      );
                    })()}
                  </div>
                </div>
              </div>
            )}

            {/* ═══════════════════════ RED ═══════════════════════ */}
            {optimizerTab === 'network' && (
              <div className="space-y-6">
                {/* WiFi */}
                <div className={`${dark ? 'glow-card' : `${t.panel} border ${t.border} shadow-sm`} rounded-xl p-6`}>
                  <p className={`text-[10px] ${t.textSub} uppercase tracking-widest font-bold mb-4`}>Optimización de Wi-Fi</p>
                  <div className="space-y-4">
                    <div>
                      <p className={`text-xs ${t.textMuted} mb-2`}>Intervalo de escaneo (ms) — 0 = sin límite</p>
                      <div className="flex gap-2">
                        {[{v:0,l:'Sin límite'},{v:15000,l:'15s (Defecto)'},{v:30000,l:'30s'},{v:60000,l:'60s (Ahorro)'}].map(({v,l}) => {
                          const isActive = wifiScanInterval === v;
                          return (
                            <button key={v} onClick={async () => {
                              setWifiScanInterval(v);
                              await run('set_wifi_scan_interval', '', { interval: v }, false);
                              addLog(`Búsqueda Wi-Fi: ${l}`);
                            }}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-bold border transition-all ${
                              isActive
                                ? dark
                                  ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
                                  : 'bg-blue-600 border-blue-600 text-white'
                                : dark
                                  ? 'bg-white/[0.03] border-white/10 hover:bg-blue-500/10 text-white/60'
                                  : 'bg-slate-50 border-slate-200 hover:bg-blue-50 text-slate-600'
                            }`}>{l}</button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={async () => {
                        setWifiPowerSave(true);
                        await run('set_wifi_power_save', '', { enabled: true }, false);
                        addLog('Ahorro de energía Wi-Fi: activado');
                      }}
                      className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                        wifiPowerSave
                          ? dark
                            ? 'bg-green-500/20 border-green-500/40 text-green-300 shadow-sm'
                            : 'bg-green-600 border-green-600 text-white'
                          : dark
                            ? 'bg-white/[0.03] border-white/10 text-white/60 hover:bg-white/10'
                            : 'bg-slate-50 border-slate-200 text-slate-500'
                      }`}>Ahorro activado</button>
                      <button onClick={async () => {
                        setWifiPowerSave(false);
                        await run('set_wifi_power_save', '', { enabled: false }, false);
                        addLog('Ahorro de energía Wi-Fi: desactivado');
                      }}
                      className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                        !wifiPowerSave
                          ? dark
                            ? 'bg-blue-500/20 border-blue-500/40 text-blue-300 shadow-sm'
                            : 'bg-blue-600 border-blue-600 text-white'
                          : dark
                            ? 'bg-white/[0.03] border-white/10 text-white/60 hover:bg-white/10'
                            : 'bg-slate-50 border-slate-200 text-slate-500'
                      }`}>Ahorro desactivado</button>
                    </div>
                  </div>
                </div>
                {/* DNS */}
                <div className={`${dark ? 'glow-card' : `${t.panel} border ${t.border} shadow-sm`} rounded-xl p-6`}>
                  <p className={`text-[10px] ${t.textSub} uppercase tracking-widest font-bold mb-4`}>DNS Privado {privateDnsSpecifier && <span className="text-blue-400 font-normal">({privateDnsSpecifier})</span>}</p>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={async () => {
                      setPrivateDnsMode('off');
                      await run('set_private_dns', '', { mode: 'off' }, false);
                      addLog('DNS Privado: OFF');
                    }}
                    className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                      privateDnsMode === 'off'
                        ? dark
                          ? 'bg-blue-500/20 border-blue-500/40 text-blue-300 shadow-sm'
                          : 'bg-blue-600 border-blue-600 text-white'
                        : dark
                          ? 'bg-white/[0.03] border-white/10 hover:bg-white/10 text-white/60'
                          : 'bg-slate-50 border-slate-200 text-slate-500'
                    }`}>Desactivado</button>
                    <button onClick={async () => {
                      setPrivateDnsMode('automatic');
                      await run('set_private_dns', '', { mode: 'automatic' }, false);
                      addLog('DNS Privado: Automático');
                    }}
                    className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                      privateDnsMode === 'automatic'
                        ? dark
                          ? 'bg-blue-500/20 border-blue-500/40 text-blue-300 shadow-sm'
                          : 'bg-blue-600 border-blue-600 text-white'
                        : dark
                          ? 'bg-white/[0.03] border-white/10 hover:bg-white/10 text-white/60'
                          : 'bg-slate-50 border-slate-200 text-slate-500'
                    }`}>Automático</button>
                    <button onClick={async () => {
                      const host = prompt('Servidor DNS (ej: dns.google):', privateDnsSpecifier);
                      if (host) {
                        setPrivateDnsMode('hostname');
                        setPrivateDnsSpecifier(host);
                        await run('set_private_dns', '', { mode: 'hostname', hostname: host }, false);
                        addLog(`DNS: ${host}`);
                      }
                    }}
                    className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                      privateDnsMode === 'hostname'
                        ? dark
                          ? 'bg-blue-500/20 border-blue-500/40 text-blue-300 shadow-sm'
                          : 'bg-blue-600 border-blue-600 text-white'
                        : dark
                          ? 'bg-white/[0.03] border-white/10 hover:bg-blue-500/10 text-blue-400'
                          : 'bg-slate-50 border-slate-200 text-slate-700'
                    }`}>Personalizado…</button>
                  </div>
                </div>
              </div>
            )}

            {/* ═══════════════════════ NOTIFICACIONES — ESTILO iOS ═══════════════════════ */}
            {optimizerTab === 'notifications' && (
              <div className="space-y-6">
                {/* Header explicativo */}
                <div className={`${dark ? 'settings-panel' : `${t.panel} border ${t.border} shadow-sm`} rounded-xl p-6`}>
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 rounded-xl bg-[#1bae6e]/15 flex items-center justify-center shrink-0">
                      <Bell size={24} className="text-[#22c97d]" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold mb-1">Panel de notificaciones</h3>
                      <p className={`text-xs ${t.textMuted} leading-relaxed`}>
                        Mejora la legibilidad del panel de notificaciones de tu dispositivo Android,
                        reduciendo transparencias y acelerando las animaciones compatibles.
                        Los cambios se aplican al instante vía ADB, sin root.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Master toggle: Aplicar todo */}
                <div className={`${dark ? 'settings-panel' : `${t.panel} border ${t.border} shadow-sm`} rounded-xl p-5`}>
                  <button
                    onClick={async () => {
                      setShadeApplying(true);
                      const enable = !shadeHighContrast || !shadeReduceBlur || !shadeBoldText || !shadeSolidTheme || !shadeFastAnims;
                      setShadeHighContrast(enable);
                      setShadeReduceBlur(enable);
                      setShadeBoldText(enable);
                      setShadeSolidTheme(enable);
                      setShadeFastAnims(enable);
                      await run('set_shade_style', enable ? 'Aplicando perfil de legibilidad...' : 'Restaurando valores por defecto...', {
                        highContrast: enable,
                        reduceBlur: enable,
                        boldText: enable,
                        solidTheme: enable,
                        animationsFast: enable,
                      });
                      setShadeApplying(false);
                    }}
                    disabled={shadeApplying}
                    className={`w-full py-4 rounded-xl font-bold text-sm flex items-center justify-center gap-3 transition-all duration-200 ${
                      shadeHighContrast && shadeReduceBlur && shadeBoldText && shadeSolidTheme && shadeFastAnims
                        ? dark
                          ? 'bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20'
                          : 'bg-red-100 border border-red-200 text-red-600 hover:bg-red-200'
                        : dark
                          ? 'bg-[#1bae6e] hover:bg-[#22c97d] text-white shadow-sm shadow-[#1bae6e]/30'
                          : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm shadow-emerald-600/20'
                    }`}
                  >
                    {shadeApplying ? (
                      <><RefreshCw size={18} className="animate-spin" /> Aplicando…</>
                    ) : shadeHighContrast && shadeReduceBlur && shadeBoldText && shadeSolidTheme && shadeFastAnims ? (
                      <><RefreshCw size={18} /> Restaurar Valores por Defecto</>
                    ) : (
                      <><Sparkles size={18} /> Aplicar perfil recomendado</>
                    )}
                  </button>
                  <p className={`text-[10px] ${t.textMuted} text-center mt-3`}>
                    {shadeHighContrast && shadeReduceBlur && shadeBoldText && shadeSolidTheme && shadeFastAnims
                      ? 'Perfil recomendado activo'
                      : 'Aplica todas las optimizaciones con un solo toque'}
                  </p>
                </div>

                {/* Toggles individuales */}
                <div className={`${dark ? 'settings-panel' : `${t.panel} border ${t.border} shadow-sm`} rounded-xl p-5`}>
                  <p className={`text-[10px] ${t.textSub} uppercase tracking-widest font-bold mb-4`}>Ajustes Individuales</p>
                  <div className="space-y-3">
                    {[
                      {
                        icon: Eye,
                        label: 'Alto Contraste',
                        desc: 'Texto más nítido y legible sobre fondos borrosos. Mejora el contraste del texto sobre fondos translúcidos.',
                        active: shadeHighContrast,
                        setter: setShadeHighContrast,
                        body: { highContrast: !shadeHighContrast },
                      },
                      {
                        icon: Minimize2,
                        label: 'Reducir Transparencia',
                        desc: 'Desactiva el blur del sistema. Reduce transparencias para obtener fondos más sólidos.',
                        active: shadeReduceBlur,
                        setter: setShadeReduceBlur,
                        body: { reduceBlur: !shadeReduceBlur },
                      },
                      {
                        icon: Maximize,
                        label: 'Texto Legible',
                        desc: 'Aumenta ligeramente el tamaño de fuente del sistema para mejor lectura en notificaciones.',
                        active: shadeBoldText,
                        setter: setShadeBoldText,
                        body: { boldText: !shadeBoldText },
                      },
                      {
                        icon: Moon,
                        label: 'Tema Sólido Oscuro',
                        desc: 'Forza el modo oscuro con fondos opacos. El panel deja de ser translúcido.',
                        active: shadeSolidTheme,
                        setter: setShadeSolidTheme,
                        body: { solidTheme: !shadeSolidTheme },
                      },
                      {
                        icon: Zap,
                        label: 'Animaciones Rápidas',
                        desc: 'Reduce animaciones a 0.5x. El panel aparece instantáneo, sin blur de transición.',
                        active: shadeFastAnims,
                        setter: setShadeFastAnims,
                        body: { animationsFast: !shadeFastAnims },
                      },
                    ].map(({ icon: Icon, label, desc, active, setter, body }) => (
                      <button
                        key={label}
                        onClick={async () => {
                          setter(!active);
                          await run('set_shade_style', '', body, false);
                          addLog(`Notificaciones: ${label} ${!active ? 'activado' : 'desactivado'}`);
                        }}
                        className={`w-full flex items-center gap-4 p-4 rounded-xl text-left transition-all border ${
                          active
                            ? dark
                              ? 'bg-[#1bae6e]/10 border-[#1bae6e]/30'
                              : 'bg-emerald-50 border-emerald-300'
                            : dark
                              ? 'bg-white/[0.02] border-white/5 hover:bg-white/[0.04]'
                              : 'bg-white border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                          active
                            ? dark ? 'bg-[#1bae6e]/20 text-[#22c97d]' : 'bg-emerald-100 text-emerald-700'
                            : dark ? 'bg-white/5 text-white/30' : 'bg-slate-100 text-slate-400'
                        }`}>
                          <Icon size={18} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-bold ${active ? (dark ? 'text-[#22c97d]' : 'text-emerald-700') : t.text}`}>{label}</p>
                          <p className={`text-[10px] ${active ? (dark ? 'text-[#22c97d]/70' : 'text-emerald-600') : t.textMuted} mt-0.5`}>{desc}</p>
                        </div>
                        <div className={`w-12 h-7 rounded-full transition-all duration-200 shrink-0 ${
                          active
                            ? 'bg-[#1bae6e]'
                            : dark ? 'bg-white/10' : 'bg-slate-200'
                        } relative`}>
                          <div className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-md transition-all duration-200 ${
                            active ? 'right-0.5' : 'left-0.5'
                          }`} />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Preview visual */}
                <div className={`${dark ? 'settings-panel' : `${t.panel} border ${t.border} shadow-sm`} rounded-xl p-6`}>
                  <p className={`text-[10px] ${t.textSub} uppercase tracking-widest font-bold mb-4`}>Vista Previa del Panel</p>
                  <div className={`mx-auto max-w-[280px] rounded-[28px] overflow-hidden border-2 ${dark ? 'border-white/10' : 'border-slate-200'}`}>
                    {/* Mock status bar */}
                    <div className={`px-5 py-2 flex justify-between items-center text-[9px] font-semibold ${shadeSolidTheme ? (dark ? 'bg-[#0d1117]' : 'bg-white') : dark ? 'bg-white/5' : 'bg-slate-50'}`}>
                      <span className={shadeSolidTheme ? (dark ? 'text-white' : 'text-black') : t.textMuted}>9:41</span>
                      <div className="flex gap-1 items-center">
                        <Wifi size={10} className={shadeHighContrast ? 'text-[#22c97d]' : t.textSub} />
                        <Battery size={10} className={shadeHighContrast ? 'text-[#22c97d]' : t.textSub} />
                      </div>
                    </div>
                    {/* Mock QS Panel */}
                    <div className={`p-4 space-y-3 ${shadeSolidTheme ? (dark ? 'bg-[#111622]' : 'bg-gray-100') : dark ? 'backdrop-blur-xl bg-white/[0.07]' : 'backdrop-blur-xl bg-white/70'}`}
                      style={shadeSolidTheme ? {} : { backdropFilter: 'blur(20px)' }}>
                      <p className={`text-xs font-bold ${shadeHighContrast ? 'text-white' : t.textMuted}`}>
                        {shadeSolidTheme ? 'Panel sólido' : 'Panel translúcido'}
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        {['Wi-Fi', 'Bluetooth', 'Brillo', 'Sonido'].map(label => (
                          <div key={label} className={`p-3 rounded-xl text-center text-[10px] font-semibold transition-all ${
                            shadeReduceBlur
                              ? dark ? 'bg-[#1bae6e]/20 text-[#22c97d]' : 'bg-emerald-100 text-emerald-700'
                              : dark ? 'bg-white/[0.06] text-white/40' : 'bg-white/50 text-slate-500'
                          }`}>
                            {label}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <p className={`text-[10px] ${t.textMuted} text-center mt-3`}>
                    Vista aproximada del panel de notificaciones
                  </p>
                </div>
              </div>
            )}

            {/* ═══════════════════════ DIAGNÓSTICO ═══════════════════════ */}
            {optimizerTab === 'diagnostics' && (
              <div className="space-y-6">
                <button onClick={async () => {
                  setDiagLoading(true);
                  try {
                    const r = await fetch('/api/actions', {
                      method: 'POST',
                      body: JSON.stringify({ action: 'get_diagnostics', ip: deviceIP, serial: activeSerial }),
                      headers: { 'Content-Type': 'application/json' },
                    });
                    const d = await r.json();
                    if (d.success) setDiagnostics(d.diagnostics);
                    addLog('Diagnóstico completo obtenido');
                  } catch { addLog('✗ Error de diagnóstico'); }
                  finally { setDiagLoading(false); }
                }}
                className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                  dark ? 'bg-[#1bae6e]/15 hover:bg-[#1bae6e]/20 text-[#22c97d] border border-[#1bae6e]/25' : 'bg-blue-100 hover:bg-blue-200 text-blue-700'
                }`}>
                  {diagLoading ? <><RefreshCw size={16} className="animate-spin"/> Analizando…</> : <><Search size={16} /> Ejecutar Diagnóstico Completo</>}
                </button>

                {diagnostics && (
                  <div className="space-y-4">
                    {/* CPU */}
                    {diagnostics.cpu && (
                      <div className={`${dark ? 'settings-panel' : `${t.panel} border ${t.border} shadow-sm`} rounded-xl p-5`}>
                        <p className={`text-[10px] ${t.textSub} uppercase tracking-widest font-bold mb-3`}>CPU / Procesador</p>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {diagnostics.cpu.hardware && <><span className={t.textMuted}>Hardware:</span><span className="font-bold">{diagnostics.cpu.hardware}</span></>}
                          {diagnostics.cpu.processor && <><span className={t.textMuted}>Procesador:</span><span className="font-bold">{diagnostics.cpu.processor}</span></>}
                          {diagnostics.cpu.cores && <><span className={t.textMuted}>Núcleos:</span><span className="font-bold">{diagnostics.cpu.cores}</span></>}
                          {diagnostics.arch && <><span className={t.textMuted}>Arquitectura:</span><span className="font-bold">{diagnostics.arch}</span></>}
                          {diagnostics.sdk && <><span className={t.textMuted}>SDK:</span><span className="font-bold">{diagnostics.sdk}</span></>}
                          {diagnostics.kernel && <><span className={t.textMuted}>Kernel:</span><span className="font-bold">{diagnostics.kernel}</span></>}
                          {diagnostics.display_resolution && <><span className={t.textMuted}>Resolución:</span><span className="font-bold">{diagnostics.display_resolution.split(':')[1]?.trim()}</span></>}
                          {diagnostics.display_dpi && <><span className={t.textMuted}>DPI:</span><span className="font-bold">{diagnostics.display_dpi.split(':')[1]?.trim()}</span></>}
                          {diagnostics.uptime && <><span className={t.textMuted}>Tiempo activo:</span><span className="font-bold">{diagnostics.uptime}</span></>}
                        </div>
                      </div>
                    )}
                    {/* RAM */}
                    {diagnostics.ram && (
                      <div className={`${dark ? 'settings-panel' : `${t.panel} border ${t.border} shadow-sm`} rounded-xl p-5`}>
                        <p className={`text-[10px] ${t.textSub} uppercase tracking-widest font-bold mb-3`}>Memoria RAM</p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                          {Object.entries(diagnostics.ram as Record<string,string>).slice(0,9).map(([k,v]) => (
                            <div key={k} className={`p-3 rounded-xl text-center ${dark ? 'bg-white/[0.03] border border-white/5' : 'bg-slate-50 border border-slate-200'}`}>
                              <p className={`text-[10px] ${t.textMuted} mb-1 capitalize`}>{k.replace(/_/g,' ')}</p>
                              <p className="font-bold text-sm">{v}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Storage */}
                    {diagnostics.storage && (
                      <div className={`${dark ? 'settings-panel' : `${t.panel} border ${t.border} shadow-sm`} rounded-xl p-5`}>
                        <p className={`text-[10px] ${t.textSub} uppercase tracking-widest font-bold mb-4`}>Almacenamiento Interno</p>
                        {/* Usage bar */}
                        {(() => {
                          const s = diagnostics.storage;
                          const usageStr = String(s.usage || '0').replace('%','').trim();
                          const usageNum = parseFloat(usageStr) || 0;
                          const barClass = usageNum > 85 ? 'usage-high' : usageNum > 60 ? 'usage-medium' : 'usage-low';
                          return (
                            <div className="mb-4">
                              <div className="flex justify-between items-end mb-2">
                                <div>
                                  <p className="text-2xl font-black tracking-tight">{s.size || '--'}</p>
                                  <p className={`text-[10px] ${t.textMuted}`}>Capacidad total</p>
                                </div>
                                <div className="text-right">
                                  <p className={`text-lg font-bold ${usageNum > 85 ? 'text-red-400' : usageNum > 60 ? 'text-[#22c97d]' : 'text-[#22c97d]'}`}>{usageNum.toFixed(1)}% usado</p>
                                  <p className={`text-[10px] ${t.textMuted}`}>{s.used || '--'} de {s.size || '--'}</p>
                                </div>
                              </div>
                              <div className="usage-bar-track h-3">
                                <div className={`usage-bar-fill h-3 ${barClass}`} style={{ width: `${Math.min(usageNum, 100)}%` }} />
                              </div>
                              <div className="flex justify-between mt-2 text-[10px]">
                                <span className="text-[#22c97d] font-semibold">{s.free || '--'} libre</span>
                                <span className={t.textMuted}>{usageNum < 70 ? '✓ Espacio suficiente' : usageNum < 90 ? '⚠ Casi lleno' : '⛔ Crítico'}</span>
                              </div>
                            </div>
                          );
                        })()}
                        <button onClick={async () => { await run('run_trim', 'Limpiando caché...', {}, false); }}
                          className={`w-full py-2.5 rounded-xl text-[11px] font-bold border transition-all flex items-center justify-center gap-2 ${dark ? 'bg-[#1bae6e]/10 border-[#1bae6e]/25 text-[#22c97d] hover:bg-[#1bae6e]/20' : 'bg-green-100 border-green-300 text-green-700 hover:bg-green-200'}`}>
                          <Trash2 size={13} /> Liberar espacio (limpiar caché)
                        </button>
                      </div>
                    )}
                    {/* Thermal */}
                    {diagnostics.thermal && (diagnostics.thermal as string[]).length > 0 && (
                      <div className={`${dark ? 'settings-panel' : `${t.panel} border ${t.border} shadow-sm`} rounded-xl p-5`}>
                        <p className={`text-[10px] ${t.textSub} uppercase tracking-widest font-bold mb-3`}>Sensores Térmicos</p>
                        <div className="grid grid-cols-2 gap-2">
                          {(diagnostics.thermal as string[]).map((t,i) => (
                            <div key={i} className={`p-2 rounded-lg text-xs ${dark?'bg-white/[0.03]':'bg-slate-50'}`}>
                              <span className="font-mono">{t}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Batería */}
                    {diagnostics.battery_health && (
                      <div className={`${dark ? 'settings-panel' : `${t.panel} border ${t.border} shadow-sm`} rounded-xl p-5`}>
                        <p className={`text-[10px] ${t.textSub} uppercase tracking-widest font-bold mb-3`}>Batería</p>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          {['health','level','status','temperature','technology','voltage'].map(k => (
                            diagnostics[`battery_${k}`] && (
                              <div key={k} className={`p-2 rounded-lg text-center ${dark?'bg-white/[0.03]':'bg-slate-50'}`}>
                                <p className={`text-[10px] ${t.textMuted}`}>{k}</p>
                                <p className="font-bold">{String(diagnostics[`battery_${k}`])}</p>
                              </div>
                            )
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── CONFIG VIEW ── */}
        <div className={`min-w-0 max-w-full flex-1 overflow-x-hidden overflow-y-auto p-4 md:p-6 transition-all duration-200 ${activeNav === 'config' ? 'opacity-100 translate-y-0 relative z-0' : 'opacity-0 translate-y-4 absolute inset-0 pointer-events-none'}`}>
          <div className="mx-auto w-full min-w-0 max-w-4xl space-y-6">
            {/* Encabezado */}
            <div className={`${dark ? 'glow-card' : `${t.panel} border ${t.border} shadow-sm`} rounded-xl p-6`}>
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${dark ? 'bg-[#1bae6e]/15 text-[#22c97d]' : 'bg-emerald-100 text-emerald-600'}`}>
                  <Settings size={20} />
                </div>
                <div>
                  <h2 className={`text-base font-bold ${t.text}`}>Ajustes del sistema</h2>
                  <p className={`text-[11px] ${t.textSub}`}>Información técnica utilizada por la aplicación.</p>
                </div>
              </div>
            </div>

            {/* Rutas del sistema */}
            <div className={`${dark ? 'settings-panel' : `${t.panel} border ${t.border} shadow-sm`} rounded-xl p-6 space-y-1`}>
              <p className={`text-[10px] ${t.textSub} uppercase tracking-[0.15em] font-bold mb-2 flex items-center gap-2`}>
                <FolderOpen size={13} /> Rutas del sistema
              </p>
              <ConfigRow dark={dark} icon={<HardDrive size={14} />} label="Binario ADB" value={configData.adb || 'No configurado'} />
              <ConfigRow dark={dark} icon={<Monitor size={14} />} label="Motor de transmisión" value={configData.streamingEngine || 'No configurado'} />
              <ConfigRow dark={dark} icon={<Zap size={14} />} label="Fastboot" value={configData.fastboot || 'No configurado'} />
              <ConfigRow dark={dark} icon={<HardDrive size={14} />} label="Directorio raíz" value={configData.home || 'No configurado'} />
              <ConfigRow dark={dark} icon={<Camera size={14} />} label="Capturas y grabaciones" value={configData.capturesDir || 'No configurado'} />
            </div>

            {/* Red y puertos */}
            <div className={`${dark ? 'settings-panel' : `${t.panel} border ${t.border} shadow-sm`} rounded-xl p-6 space-y-1`}>
              <p className={`text-[10px] ${t.textSub} uppercase tracking-[0.15em] font-bold mb-2 flex items-center gap-2`}>
                <Wifi size={13} /> Red y puertos
              </p>
              <ConfigRow dark={dark} icon={<Wifi size={14} />} label="Puerto de conexión Wi-Fi (ADB)" value={String(configData.wifiPort || 5555)} />
              <ConfigRow dark={dark} icon={<Globe size={14} />} label="Puerto de datos API" value={String(configData.apiPort || 3001)} />
              <ConfigRow dark={dark} icon={<Radio size={14} />} label="Puerto WebSocket de transmisión" value={String(configData.streamingWsPort || 3002)} />
            </div>

            {/* Información del software */}
            <div className={`${dark ? 'settings-panel' : `${t.panel} border ${t.border} shadow-sm`} rounded-xl p-6 space-y-1`}>
              <p className={`text-[10px] ${t.textSub} uppercase tracking-[0.15em] font-bold mb-2 flex items-center gap-2`}>
                <Code size={13} /> Información del software
              </p>
              <ConfigRow dark={dark} icon={<Sparkles size={14} />} label="Versión del software" value={configData.version || 'No disponible'} />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

// ── Helper Components ──────────────────────────────────────────────────────
function ConfigRow({ icon, label, value, dark }: { icon: React.ReactNode; label: string; value: string; dark: boolean }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className={`flex items-center gap-3 py-3 border-b ${dark ? 'border-white/5' : 'border-slate-100'} last:border-0 group transition-colors ${dark ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-50'} -mx-2 px-2 rounded-xl`}>
      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${dark ? 'bg-white/[0.05] text-white/40' : 'bg-slate-100 text-slate-500'}`}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className={`text-[11px] font-semibold ${dark ? 'text-white/50' : 'text-slate-500'} mb-0.5`}>{label}</p>
        <p className={`text-xs font-mono truncate ${dark ? 'text-white/80' : 'text-slate-800'} ${dark ? 'bg-white/[0.03]' : 'bg-slate-50'} px-2 py-1 rounded-md`} title={value}>{value}</p>
      </div>
      <button
        onClick={handleCopy}
        className={`shrink-0 p-1.5 rounded-lg transition-all duration-200 ${dark ? 'hover:bg-white/[0.08] text-white/25 hover:text-[#22c97d]' : 'hover:bg-slate-200 text-slate-400 hover:text-emerald-600'} ${copied ? (dark ? 'text-[#22c97d] !bg-[#1bae6e]/15' : 'text-emerald-600 !bg-emerald-50') : ''}`}
        title="Copiar al portapapeles"
      >
        {copied ? <Check size={13} /> : <Copy size={13} />}
      </button>
    </div>
  );
}

function AppIcon({ app, dark }: { app: AppInfo; dark: boolean }) {
  const [imgError, setImgError] = useState(false);
  const iconUrl = `/api/apps/icon?package=${app.packageName}`;

  if (imgError) {
    const IconComponent = app.isSystem ? Settings : LayoutGrid;
    return (
      <div className={`w-10 h-10 rounded-xl ${dark ? 'bg-white/[0.05] text-white/40' : 'bg-slate-100 text-slate-400'} flex items-center justify-center shrink-0`}>
        <IconComponent size={20} />
      </div>
    );
  }

  return (
    <Image
      src={iconUrl}
      alt={app.name}
      width={40}
      height={40}
      unoptimized
      onError={() => setImgError(true)}
      loading="lazy"
      className="w-10 h-10 rounded-xl object-cover shrink-0 border border-white/5 shadow-inner"
    />
  );
}

function formatBytes(bytes: number) {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDate(timestamp: number) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  if (isNaN(date.getTime()) || timestamp < 100000000000) return '';
  return date.toLocaleDateString('es-ES', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}
