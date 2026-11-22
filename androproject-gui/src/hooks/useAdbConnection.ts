// ============================================================================
// ARCHIVO: useAdbConnection.ts
// QUÉ HACE: Hook React que gestiona el servidor ADB (start/stop/polling),
//           registro persistente de dispositivos y reconexión automática Wi-Fi.
// CÓMO FUNCIONA: Usa `hasLoadedRef` para no sobrescribir `localStorage` con `[]`
//           al montar, pausa el polling en pestañas ocultas (Visibility API) y
//           exige `serverRunning === true` antes de intentar reconexión Wi-Fi.
// POR QUÉ: Corregir reconexiones fantasma con servidor detenido, fuga/sobrescritura
//           en `localStorage` y mantener el hook bajo 200 líneas (SRP).
// ============================================================================

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  loadRegisteredDevices,
  saveRegisteredDevices,
  postAdbAction,
  type AdbDevice,
  type AdbStatusResponse,
  type RegisteredDevice,
} from './adbStorage';

export type { RegisteredDevice };

const POLL_INTERVAL = 5000;
const RECONNECT_DELAY = 3000;

export function useAdbConnection() {
  const [serverRunning, setServerRunning] = useState(false);
  const [devices, setDevices] = useState<AdbDevice[]>([]);
  const [registeredDevices, setRegisteredDevices] = useState<RegisteredDevice[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasLoadedRef = useRef(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    setRegisteredDevices(loadRegisteredDevices());
    hasLoadedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (hasLoadedRef.current) saveRegisteredDevices(registeredDevices);
  }, [registeredDevices]);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await postAdbAction<AdbStatusResponse>('get_adb_status');
      if (!isMountedRef.current) return data;
      setServerRunning(Boolean(data.serverRunning));
      setDevices(data.devices || []);
      setLastError(null);
      return data;
    } catch {
      if (isMountedRef.current) { setServerRunning(false); setDevices([]); }
      return null;
    }
  }, []);

  const connectToIp = useCallback(async (ip: string, port: string = '5555') => {
    setLastError(null);
    try {
      const data = await postAdbAction<{ success?: boolean; error?: string }>('connect_adb', { target: `${ip}:${port}` });
      if (data.success) { await fetchStatus(); return true; }
      setLastError(data.error || 'Error al conectar');
      return false;
    } catch {
      setLastError('Error de conexión');
      return false;
    }
  }, [fetchStatus]);

  const startServer = useCallback(async () => {
    setIsConnecting(true);
    setLastError(null);
    try {
      const data = await postAdbAction<{ success?: boolean; message?: string }>('start_adb_server');
      if (data.success) {
        setServerRunning(true);
        await new Promise((r) => setTimeout(r, 1000));
        const status = await fetchStatus();
        if (status?.devices) {
          const registered = loadRegisteredDevices();
          for (const dev of status.devices) {
            const reg = registered.find((r) => r.serial === dev.serial);
            if (reg?.autoConnect && reg.connectionType === 'Wi-Fi' && reg.ip && reg.port) {
              await connectToIp(reg.ip, reg.port);
            }
          }
        }
      } else {
        setLastError(data.message || 'Error al iniciar servidor ADB');
      }
    } catch {
      setLastError('Error de conexión al iniciar ADB');
    } finally {
      if (isMountedRef.current) setIsConnecting(false);
    }
  }, [fetchStatus, connectToIp]);

  const stopServer = useCallback(async () => {
    try {
      await postAdbAction('stop_adb_server');
      setServerRunning(false);
      setDevices([]);
    } catch { /* ignora errores al detener */ }
  }, []);

  const toggleServer = useCallback(async () => {
    await (serverRunning ? stopServer() : startServer());
  }, [serverRunning, startServer, stopServer]);

  const disconnectDevice = useCallback(async (serial: string) => {
    try { await postAdbAction('disconnect_device', { serial }); await fetchStatus(); } catch {}
  }, [fetchStatus]);

  const disconnectAll = useCallback(async () => {
    try { await postAdbAction('disconnect_device', { all: true }); await fetchStatus(); } catch {}
  }, [fetchStatus]);

  const registerDevice = useCallback((serial: string, model: string, connectionType: 'USB' | 'Wi-Fi', ip?: string, port?: string) => {
    let targetIp = ip;
    let targetPort = port || '5555';
    if (!targetIp && serial.includes(':')) {
      const [sIp, sPort] = serial.split(':');
      targetIp = sIp;
      if (sPort) targetPort = sPort;
    }
    setRegisteredDevices((prev) => {
      const match = (d: RegisteredDevice) => d.serial === serial || (Boolean(targetIp) && d.ip === targetIp);
      if (prev.some(match)) {
        return prev.map((d) => match(d)
          ? { ...d, serial, model: model || d.model, connectionType, ip: targetIp || d.ip, port: targetPort || d.port, lastSeen: Date.now() }
          : d);
      }
      return [...prev, { serial, model, connectionType, ip: targetIp, port: targetPort, lastSeen: Date.now(), autoConnect: connectionType === 'Wi-Fi' }];
    });
  }, []);

  const unregisterDevice = useCallback((serial: string) => {
    setRegisteredDevices((prev) => prev.filter((d) => d.serial !== serial));
  }, []);

  const toggleAutoConnect = useCallback((serial: string) => {
    setRegisteredDevices((prev) => prev.map((d) => (d.serial === serial ? { ...d, autoConnect: !d.autoConnect } : d)));
  }, []);

  useEffect(() => {
    if (!serverRunning) {
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
      return;
    }
    const pollIfVisible = () => {
      if (typeof document === 'undefined' || document.visibilityState !== 'hidden') fetchStatus();
    };
    pollIfVisible();
    pollRef.current = setInterval(pollIfVisible, POLL_INTERVAL);
    return () => { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; } };
  }, [serverRunning, fetchStatus]);

  useEffect(() => {
    if (!serverRunning) return;
    const activeSerials = new Set(devices.filter((d) => d.state === 'device').map((d) => d.serial));
    const disconnectedWifi = registeredDevices.filter((d) =>
      d.autoConnect && d.connectionType === 'Wi-Fi' && Boolean(d.ip) &&
      !activeSerials.has(d.serial) && !activeSerials.has(`${d.ip}:${d.port || '5555'}`),
    );
    if (disconnectedWifi.length === 0) return;

    reconnectRef.current = setTimeout(async () => {
      for (const dev of disconnectedWifi) {
        if (dev.ip) await connectToIp(dev.ip, dev.port || '5555');
      }
    }, RECONNECT_DELAY);
    return () => { if (reconnectRef.current) { clearTimeout(reconnectRef.current); reconnectRef.current = null; } };
  }, [serverRunning, devices, registeredDevices, connectToIp]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  return {
    serverRunning, devices, registeredDevices, isConnecting, lastError,
    startServer, stopServer, toggleServer, connectToIp, disconnectDevice,
    disconnectAll, fetchStatus, registerDevice, unregisterDevice, toggleAutoConnect,
  };
}
