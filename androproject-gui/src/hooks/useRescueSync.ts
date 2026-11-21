// ============================================================================
// ARCHIVO: useRescueSync.ts
// QUÉ HACE: Hook watchdog que mantiene conectado un dispositivo secundario
//           designado (modo Rescate Wi-Fi / ADB TCP/IP 5555) reconectándolo
//           automáticamente si pierde sesión inalámbrica.
// CÓMO FUNCIONA: Persiste la configuración en `localStorage` con validación
//           estricta de tipos (evitando corrupción si React inyecta un
//           `MouseEvent` en `onClick`) y ejecuta `connect_adb` cada 10s.
// POR QUÉ: Evitar `TypeError: currentConfig.targetModel.trim is not a function`
//           y cumplir el límite estricto `< 200` líneas (SOLID).
// ============================================================================
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { DeviceInfo } from '@/features/types';

export interface RescueSyncConfig {
  enabled: boolean;
  targetModel: string;
  lastKnownIp: string;
  autoArmUsb: boolean;
  keepAlivePing: boolean;
}

export type RescueSyncStatus =
  | 'idle' | 'monitoring' | 'connecting' | 'connected'
  | 'rearming_tcpip' | 'scanning_radar' | 'error';

const STORAGE_KEY = 'androproject_rescue_sync_config';
const WATCHDOG_INTERVAL_MS = 10000;

const DEFAULT_CONFIG: RescueSyncConfig = {
  enabled: false,
  targetModel: 'A30',
  lastKnownIp: '192.168.0.11',
  autoArmUsb: false,
  keepAlivePing: false,
};

/** Carga y sanitiza la configuración desde localStorage garantizando strings válidos. */
function loadConfig(): RescueSyncConfig {
  if (typeof window === 'undefined') return DEFAULT_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    const parsed = JSON.parse(raw) as Partial<RescueSyncConfig>;
    return {
      ...DEFAULT_CONFIG,
      enabled: false,
      targetModel:
        typeof parsed.targetModel === 'string' && parsed.targetModel.trim()
          ? parsed.targetModel.trim()
          : DEFAULT_CONFIG.targetModel,
      lastKnownIp:
        typeof parsed.lastKnownIp === 'string' && parsed.lastKnownIp.trim()
          ? parsed.lastKnownIp.trim()
          : DEFAULT_CONFIG.lastKnownIp,
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

function saveConfig(cfg: RescueSyncConfig): void {
  if (typeof window === 'undefined') return;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg)); } catch {}
}

export function useRescueSync(devices: DeviceInfo[], onRefresh?: () => void) {
  const [config, setConfig] = useState<RescueSyncConfig>(DEFAULT_CONFIG);
  const [isMounted, setIsMounted] = useState(false);
  const [status, setStatus] = useState<RescueSyncStatus>('idle');
  const [lastSyncMsg, setLastSyncMsg] = useState('En espera');
  const isSyncingRef = useRef(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    setConfig(loadConfig());
  }, []);

  const configRef = useRef(config);
  const devicesRef = useRef(devices);
  const onRefreshRef = useRef(onRefresh);

  useEffect(() => { configRef.current = config; }, [config]);
  useEffect(() => { devicesRef.current = devices; }, [devices]);
  useEffect(() => { onRefreshRef.current = onRefresh; }, [onRefresh]);
  useEffect(() => { if (isMounted) saveConfig(config); }, [config, isMounted]);

  /** Alterna el modo rescate ignorando objetos `MouseEvent` si se pasa a `onClick`. */
  const toggleRescueSync = useCallback((customTarget?: unknown) => {
    setConfig((prev) => ({
      ...prev,
      enabled: !prev.enabled,
      targetModel:
        typeof customTarget === 'string' && customTarget.trim()
          ? customTarget.trim()
          : typeof prev.targetModel === 'string'
          ? prev.targetModel
          : DEFAULT_CONFIG.targetModel,
    }));
  }, []);

  const updateTargetModel = useCallback((model: string) => {
    setConfig((prev) => ({ ...prev, targetModel: typeof model === 'string' ? model : DEFAULT_CONFIG.targetModel }));
  }, []);

  const updateLastKnownIp = useCallback((ip: string) => {
    setConfig((prev) => ({ ...prev, lastKnownIp: typeof ip === 'string' ? ip : DEFAULT_CONFIG.lastKnownIp }));
  }, []);

  // Bucle watchdog de supervisión y reconexión automática
  useEffect(() => {
    if (!config.enabled) {
      setStatus('idle');
      setLastSyncMsg('Modo Rescate Desactivado');
      return;
    }
    let alive = true;

    const runWatchdog = async () => {
      if (isSyncingRef.current) return;
      const currentConfig = configRef.current;
      const currentDevices = devicesRef.current;
      if (!currentConfig.enabled) return;

      const safeModelStr = typeof currentConfig.targetModel === 'string'
        ? currentConfig.targetModel
        : DEFAULT_CONFIG.targetModel;
      const targetPattern = safeModelStr.trim().toLowerCase();

      const matchedDevice = currentDevices.find((d) => {
        const model = String(d.model || '').toLowerCase();
        const serial = String(d.serial || '').toLowerCase();
        return (
          (targetPattern && (model.includes(targetPattern) || serial.includes(targetPattern))) ||
          (currentConfig.lastKnownIp && serial.includes(currentConfig.lastKnownIp))
        );
      });

      if (matchedDevice && matchedDevice.state === 'device') {
        if (!alive) return;
        setStatus('connected');
        setLastSyncMsg(`Conectado (${matchedDevice.model || matchedDevice.serial})`);
        return;
      }

      isSyncingRef.current = true;
      setIsSyncing(true);
      try {
        if (currentConfig.lastKnownIp && alive) {
          setStatus('connecting');
          setLastSyncMsg(`Reconectando a ${currentConfig.lastKnownIp}:5555...`);
          try {
            const res = await fetch('/api/actions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'connect_adb', target: `${currentConfig.lastKnownIp}:5555` }),
            });
            const data = await res.json();
            if (data?.success && alive) {
              setStatus('connected');
              setLastSyncMsg(`Reconectado a ${currentConfig.lastKnownIp}`);
              onRefreshRef.current?.();
              return;
            }
          } catch {}
        }
        if (alive) {
          setStatus('monitoring');
          setLastSyncMsg('En espera de conexión');
        }
      } finally {
        isSyncingRef.current = false;
        if (alive) setIsSyncing(false);
      }
    };

    runWatchdog();
    const interval = setInterval(runWatchdog, WATCHDOG_INTERVAL_MS);
    return () => { alive = false; clearInterval(interval); };
  }, [config.enabled, config.targetModel]);

  return { config, status, lastSyncMsg, isSyncing, toggleRescueSync, updateTargetModel, updateLastKnownIp };
}
