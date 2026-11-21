'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { DeviceInfo } from '@/features/types';

export interface RescueSyncConfig {
  enabled: boolean;
  targetModel: string; // e.g. 'A30', 'Galaxy A30', 'SM-A305', or serial
  lastKnownIp: string;
  autoArmUsb: boolean;
  keepAlivePing: boolean;
}

export type RescueSyncStatus = 
  | 'idle'
  | 'monitoring'
  | 'connecting'
  | 'connected'
  | 'rearming_tcpip'
  | 'scanning_radar'
  | 'error';

const STORAGE_KEY = 'androproject_rescue_sync_config';
const WATCHDOG_INTERVAL_MS = 10000;

const DEFAULT_CONFIG: RescueSyncConfig = {
  enabled: false, // Desactivado por defecto para evitar bucles automáticos no deseados
  targetModel: 'A30',
  lastKnownIp: '192.168.0.11',
  autoArmUsb: false,
  keepAlivePing: false,
};

function loadConfig(): RescueSyncConfig {
  if (typeof window === 'undefined') return DEFAULT_CONFIG;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_CONFIG,
      ...parsed,
      enabled: false, // Forzar desactivado para cortar el ciclo inmediatamente
      lastKnownIp: parsed.lastKnownIp || '192.168.0.11',
    };
  } catch {
    return DEFAULT_CONFIG;
  }
}

function saveConfig(cfg: RescueSyncConfig) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
  } catch { /* ignore */ }
}

export function useRescueSync(devices: DeviceInfo[], onRefresh?: () => void) {
  const [config, setConfig] = useState<RescueSyncConfig>(DEFAULT_CONFIG);
  const [isMounted, setIsMounted] = useState<boolean>(false);
  const [status, setStatus] = useState<RescueSyncStatus>('idle');
  const [lastSyncMsg, setLastSyncMsg] = useState<string>('En espera');
  const isSyncingRef = useRef<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Load from localStorage on mount
  useEffect(() => {
    setIsMounted(true);
    const loaded = loadConfig();
    setConfig(loaded);
  }, []);

  const configRef = useRef(config);
  const devicesRef = useRef(devices);
  const onRefreshRef = useRef(onRefresh);

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  useEffect(() => {
    devicesRef.current = devices;
  }, [devices]);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  // Persist config changes only after hydration
  useEffect(() => {
    if (isMounted) {
      saveConfig(config);
    }
  }, [config, isMounted]);

  // Toggle switch
  const toggleRescueSync = useCallback((customTarget?: string) => {
    setConfig(prev => {
      const next = {
        ...prev,
        enabled: !prev.enabled,
        targetModel: customTarget || prev.targetModel,
      };
      return next;
    });
  }, []);

  const updateTargetModel = useCallback((model: string) => {
    setConfig(prev => ({ ...prev, targetModel: model }));
  }, []);

  const updateLastKnownIp = useCallback((ip: string) => {
    setConfig(prev => ({ ...prev, lastKnownIp: ip }));
  }, []);

  // Watchdog & Reconnection loop
  useEffect(() => {
    if (!config.enabled) {
      setStatus('idle');
      setLastSyncMsg('Modo Rescate Desactivado');
      return;
    }

    let isWatchdogAlive = true;

    const runWatchdog = async () => {
      if (isSyncingRef.current) return;
      const currentConfig = configRef.current;
      const currentDevices = devicesRef.current;

      if (!currentConfig.enabled) return;

      const targetPattern = currentConfig.targetModel.trim().toLowerCase();

      // Check if target device is currently connected
      const matchedDevice = currentDevices.find(d => {
        const model = (d.model || '').toLowerCase();
        const serial = (d.serial || '').toLowerCase();
        return (
          model.includes(targetPattern) ||
          serial.includes(targetPattern) ||
          (currentConfig.lastKnownIp && serial.includes(currentConfig.lastKnownIp))
        );
      });

      // 1. Device is connected and ready
      if (matchedDevice && matchedDevice.state === 'device') {
        if (!isWatchdogAlive) return;
        setStatus('connected');
        setLastSyncMsg(`Conectado (${matchedDevice.model || matchedDevice.serial})`);
        return;
      }

      // 2. Device is NOT connected -> Trigger Reconnection
      isSyncingRef.current = true;
      setIsSyncing(true);

      try {
        if (currentConfig.lastKnownIp) {
          if (!isWatchdogAlive) return;
          setStatus('connecting');
          setLastSyncMsg(`Reconectando a ${currentConfig.lastKnownIp}:5555...`);

          try {
            const res = await fetch('/api/actions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'connect_adb', target: `${currentConfig.lastKnownIp}:5555` }),
            });
            const data = await res.json();

            if (data?.success) {
              if (!isWatchdogAlive) return;
              setStatus('connected');
              setLastSyncMsg(`Reconectado a ${currentConfig.lastKnownIp}`);
              onRefreshRef.current?.();
              return;
            }
          } catch { /* direct connect failed */ }
        }

        if (!isWatchdogAlive) return;
        setStatus('monitoring');
        setLastSyncMsg('En espera de conexión');
      } finally {
        isSyncingRef.current = false;
        if (isWatchdogAlive) {
          setIsSyncing(false);
        }
      }
    };

    runWatchdog();
    const interval = setInterval(runWatchdog, WATCHDOG_INTERVAL_MS);

    return () => {
      isWatchdogAlive = false;
      clearInterval(interval);
    };
  }, [config.enabled, config.targetModel]);

  return {
    config,
    status,
    lastSyncMsg,
    isSyncing,
    toggleRescueSync,
    updateTargetModel,
    updateLastKnownIp,
  };
}
