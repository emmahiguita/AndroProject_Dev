// ============================================================================
// ARCHIVO: useRescueSync.ts
// QUÉ HACE: Watchdog universal de Rescate Permanente para cualquier Android
//           con pantalla/táctil dañado. Mantiene ADB (USB/Wi-Fi), hardening
//           anti-suspensión y proyección scrcpy activos 24/7 con 1 clic.
// CÓMO FUNCIONA: Persiste estado y objetivo en `localStorage`, auto-promueve
//           USB → Wi-Fi (5555), aplica hardening periódico y relanza scrcpy
//           automáticamente si se cierra o reconecta el dispositivo.
// POR QUÉ: Permitir activar/desactivar fácilmente control permanente desde PC
//           sobre cualquier móvil sin código específico de modelo (< 200L).
// ============================================================================
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { DeviceInfo } from '@/features/types';

export interface RescueSyncConfig {
  enabled: boolean; targetSerial: string; targetModel: string; lastKnownIp: string;
  autoArmUsb: boolean; turnScreenOff: boolean; keepAlivePing: boolean;
}

export type RescueSyncStatus = 'idle' | 'monitoring' | 'connecting' | 'connected' | 'rearming_tcpip' | 'scanning_radar' | 'error';

const STORAGE_KEY = 'androproject_rescue_sync_config';
const WATCHDOG_INTERVAL_MS = 6000;
const HARDENING_INTERVAL_MS = 300000;
const DEFAULT_CONFIG: RescueSyncConfig = {
  enabled: false, targetSerial: '', targetModel: '', lastKnownIp: '',
  autoArmUsb: true, turnScreenOff: true, keepAlivePing: true,
};

const postAction = (body: Record<string, unknown>) =>
  fetch('/api/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json());

const extractIp = (serial?: string) => serial?.match(/^(\d{1,3}(?:\.\d{1,3}){3})(?::\d+)?$/)?.[1] || '';

function loadConfig(): RescueSyncConfig {
  if (typeof window === 'undefined') return DEFAULT_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_CONFIG;
    const p = JSON.parse(raw) as Partial<RescueSyncConfig>;
    return {
      enabled: Boolean(p.enabled),
      targetSerial: typeof p.targetSerial === 'string' ? p.targetSerial.trim() : '',
      targetModel: typeof p.targetModel === 'string' ? p.targetModel.trim() : '',
      lastKnownIp: typeof p.lastKnownIp === 'string' ? p.lastKnownIp.trim() : '',
      autoArmUsb: p.autoArmUsb !== false, turnScreenOff: p.turnScreenOff !== false, keepAlivePing: p.keepAlivePing !== false,
    };
  } catch { return DEFAULT_CONFIG; }
}

export function useRescueSync(devices: DeviceInfo[], onRefresh?: () => void) {
  const [config, setConfig] = useState<RescueSyncConfig>(DEFAULT_CONFIG);
  const [isMounted, setIsMounted] = useState(false);
  const [status, setStatus] = useState<RescueSyncStatus>('idle');
  const [lastSyncMsg, setLastSyncMsg] = useState('En espera');
  const [isSyncing, setIsSyncing] = useState(false);

  const isSyncingRef = useRef(false);
  const lastHardeningRef = useRef(0);
  const usbPromotedRef = useRef(new Set<string>());
  const configRef = useRef(config);
  const devicesRef = useRef(devices);
  const onRefreshRef = useRef(onRefresh);

  useEffect(() => { setIsMounted(true); setConfig(loadConfig()); }, []);
  useEffect(() => { configRef.current = config; }, [config]);
  useEffect(() => { devicesRef.current = devices; }, [devices]);
  useEffect(() => { onRefreshRef.current = onRefresh; }, [onRefresh]);
  useEffect(() => {
    if (!isMounted) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(config)); } catch {}
  }, [config, isMounted]);

  const toggleRescueSync = useCallback((device?: DeviceInfo | unknown) => {
    const dev = device && typeof device === 'object' && 'serial' in device ? (device as DeviceInfo) : undefined;
    setConfig((prev) => {
      if (prev.enabled) {
        lastHardeningRef.current = 0;
        usbPromotedRef.current.clear();
        const serialToStop = dev?.serial || prev.targetSerial;
        if (serialToStop) void postAction({ action: 'stop_screen', serial: serialToStop }).catch(() => {});
        return { ...prev, enabled: false };
      }
      const isAndroid = dev && !dev.serial.startsWith('airplay-') && !dev.serial.startsWith('apple-');
      const ip = isAndroid ? extractIp(dev.serial) : '';
      return {
        ...prev, enabled: true,
        targetSerial: isAndroid ? dev.serial : prev.targetSerial,
        targetModel: isAndroid ? (dev.model || dev.serial) : prev.targetModel,
        lastKnownIp: ip || prev.lastKnownIp,
      };
    });
  }, []);

  const updateTargetModel = useCallback((model: string) => setConfig((p) => ({ ...p, targetModel: typeof model === 'string' ? model : '' })), []);
  const updateLastKnownIp = useCallback((ip: string) => setConfig((p) => ({ ...p, lastKnownIp: typeof ip === 'string' ? ip.trim() : '' })), []);

  useEffect(() => {
    if (!config.enabled) { setStatus('idle'); setLastSyncMsg('Rescate desactivado'); return; }
    let alive = true;

    const runWatchdog = async () => {
      const cfg = configRef.current;
      if (isSyncingRef.current || !cfg.enabled) return;

      const androidOnline = devicesRef.current.filter((d) => d.state === 'device' && !d.serial.startsWith('airplay-') && !d.serial.startsWith('apple-'));
      const modelPat = cfg.targetModel.trim().toLowerCase();
      const matched = androidOnline.find((d) =>
        (cfg.targetSerial && d.serial === cfg.targetSerial) || (cfg.lastKnownIp && d.serial.includes(cfg.lastKnownIp)) || (modelPat && String(d.model || '').toLowerCase().includes(modelPat)),
      ) || (!cfg.targetSerial ? androidOnline[0] : undefined);

      isSyncingRef.current = true;
      setIsSyncing(true);
      try {
        if (!matched) {
          if (cfg.lastKnownIp && alive) {
            setStatus('connecting');
            setLastSyncMsg(`Reconectando a ${cfg.lastKnownIp}:5555...`);
            const res = await postAction({ action: 'connect_adb', target: `${cfg.lastKnownIp}:5555` }).catch(() => null);
            if (res?.success && alive) { onRefreshRef.current?.(); return; }
          }
          if (alive) { setStatus('monitoring'); setLastSyncMsg('Esperando móvil por USB o Wi-Fi...'); }
          return;
        }

        const learnedIp = extractIp(matched.serial);
        if (learnedIp && learnedIp !== cfg.lastKnownIp) setConfig((p) => ({ ...p, lastKnownIp: learnedIp, targetModel: matched.model || p.targetModel }));

        if (cfg.autoArmUsb && !matched.serial.includes(':') && !usbPromotedRef.current.has(matched.serial)) {
          usbPromotedRef.current.add(matched.serial);
          setStatus('rearming_tcpip');
          const wifiRes = await postAction({ action: 'enable_wifi', serial: matched.serial }).catch(() => null);
          if (wifiRes?.ip) setConfig((p) => ({ ...p, lastKnownIp: wifiRes.ip }));
        }

        if (Date.now() - lastHardeningRef.current > HARDENING_INTERVAL_MS) {
          lastHardeningRef.current = Date.now();
          await postAction({ action: 'apply_rescue_hardening', serial: matched.serial, enabled: true }).catch(() => {});
        }

        const scr = await postAction({ action: 'check_screen', serial: matched.serial }).catch(() => null);
        if (!scr?.alive && alive) {
          await postAction({ action: 'open_screen', serial: matched.serial, stayAwake: true, alwaysOnTop: true, turnScreenOff: cfg.turnScreenOff }).catch(() => {});
        }

        if (alive) { setStatus('connected'); setLastSyncMsg(`Activo · ${matched.model || matched.serial}`); }
      } finally {
        isSyncingRef.current = false;
        if (alive) setIsSyncing(false);
      }
    };

    void runWatchdog();
    const interval = setInterval(() => { void runWatchdog(); }, WATCHDOG_INTERVAL_MS);
    return () => { alive = false; clearInterval(interval); };
  }, [config.enabled, config.targetSerial, config.targetModel, config.turnScreenOff]);

  return { config, status, lastSyncMsg, isSyncing, toggleRescueSync, updateTargetModel, updateLastKnownIp };
}
