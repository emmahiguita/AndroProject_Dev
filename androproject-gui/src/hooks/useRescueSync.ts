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
const WATCHDOG_INTERVAL_MS = 7000;

const DEFAULT_CONFIG: RescueSyncConfig = {
  enabled: true,
  targetModel: 'A30',
  lastKnownIp: '192.168.0.11',
  autoArmUsb: true,
  keepAlivePing: true,
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

  // Load from localStorage on mount (eliminates SSR hydration mismatch)
  useEffect(() => {
    setIsMounted(true);
    const loaded = loadConfig();
    setConfig(loaded);
  }, []);

  const configRef = useRef(config);
  const devicesRef = useRef(devices);

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  useEffect(() => {
    devicesRef.current = devices;
  }, [devices]);

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

        // If connected via USB and autoArmUsb is enabled, ensure TCP/IP port 5555 is armed & connect Wi-Fi
        if (matchedDevice.connectionType === 'USB' && currentConfig.autoArmUsb) {
          try {
            const res = await fetch('/api/actions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'enable_wifi', serial: matchedDevice.serial }),
            });
            const data = await res.json();
            if (data?.ip) {
              if (data.ip !== currentConfig.lastKnownIp) {
                updateLastKnownIp(data.ip);
              }
              onRefresh?.();
            }
          } catch { /* ignore */ }
        }

        // Auto-Project: Check if screen projection is enabled for this device
        try {
          const prefKey = `androproject_stream_pref_${matchedDevice.serial}`;
          const savedPref = typeof window !== 'undefined' ? localStorage.getItem(prefKey) : null;
          // Default to ON for A30 or if preference is true
          const shouldStream = savedPref !== null ? savedPref === 'true' : true;

          if (shouldStream) {
            const checkRes = await fetch('/api/actions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'check_screen', serial: matchedDevice.serial }),
            });
            const checkData = await checkRes.json();
            if (!checkData?.alive) {
              await fetch('/api/actions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  action: 'open_screen',
                  serial: matchedDevice.serial,
                  maxSize: '1080',
                  maxFps: '60',
                  bitRate: matchedDevice.connectionType === 'Wi-Fi' ? '8M' : '16M',
                  videoBuffer: matchedDevice.connectionType === 'Wi-Fi' ? '10' : '0',
                }),
              });
            }
          }
        } catch { /* ignore */ }

        // Keep-alive ping
        if (currentConfig.keepAlivePing && matchedDevice.connectionType === 'Wi-Fi') {
          try {
            await fetch('/api/actions', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'adb_shell', serial: matchedDevice.serial, cmd: 'getprop ro.product.model' }),
            });
          } catch { /* ignore */ }
        }
        return;
      }

      // 2. Device is NOT connected -> Trigger Auto-Reconnect
      isSyncingRef.current = true;
      setIsSyncing(true);

      try {
        // Step A: If we have a saved IP, attempt direct connection
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
              onRefresh?.();
              return;
            }
          } catch { /* try radar */ }
        }

        // Step B: Direct connect failed or no IP saved -> Run Radar Scan on local subnet
        if (!isWatchdogAlive) return;
        setStatus('scanning_radar');
        setLastSyncMsg('Buscando dispositivo en la red Wi-Fi...');

        try {
          const res = await fetch('/api/actions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'scan_radar' }),
          });
          const data = await res.json();

          if (data?.success) {
            if (!isWatchdogAlive) return;
            onRefresh?.();
          } else {
            if (!isWatchdogAlive) return;
            setStatus('monitoring');
            setLastSyncMsg('Esperando que el dispositivo se una a la red Wi-Fi');
          }
        } catch {
          if (!isWatchdogAlive) return;
          setStatus('monitoring');
          setLastSyncMsg('Monitor de red activo');
        }
      } finally {
        isSyncingRef.current = false;
        if (isWatchdogAlive) {
          setIsSyncing(false);
        }
      }
    };

    // Run immediately and every interval
    runWatchdog();
    const interval = setInterval(runWatchdog, WATCHDOG_INTERVAL_MS);

    return () => {
      isWatchdogAlive = false;
      clearInterval(interval);
    };
  }, [config.enabled, config.targetModel, config.lastKnownIp, onRefresh, updateLastKnownIp]);

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
