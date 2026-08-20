'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * Registered device — persisted in localStorage so the app remembers
 * devices across sessions.
 */
export interface RegisteredDevice {
  serial: string;
  model: string;
  connectionType: 'USB' | 'Wi-Fi';
  ip?: string;
  port?: string;
  lastSeen: number;
  autoConnect: boolean;
}

interface AdbDevice {
  serial: string;
  state: string;
  model: string;
  connectionType: string;
}

interface AdbStatusResponse {
  success: boolean;
  serverRunning: boolean;
  devices: AdbDevice[];
  deviceCount: number;
}

const STORAGE_KEY = 'androproject_registered_devices';
const POLL_INTERVAL = 5000;
const RECONNECT_DELAY = 3000;

function loadRegisteredDevices(): RegisteredDevice[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRegisteredDevices(devices: RegisteredDevice[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(devices));
  } catch { /* quota exceeded — ignore */ }
}

/**
 * useAdbConnection — manages ADB server lifecycle, device registration,
 * and persistent connections.
 *
 * Features:
 * - Toggle ADB server on/off
 * - Auto-detect registered devices when server starts
 * - Persist device list across sessions
 * - Auto-reconnect to previously connected devices
 * - Support for multiple simultaneous devices
 */
export function useAdbConnection() {
  const [serverRunning, setServerRunning] = useState(false);
  const [devices, setDevices] = useState<AdbDevice[]>([]);
  const [registeredDevices, setRegisteredDevices] = useState<RegisteredDevice[]>([]);
  const [isConnecting, setIsConnecting] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectRef = useRef<NodeJS.Timeout | null>(null);

  // Load registered devices on mount
  useEffect(() => {
    setRegisteredDevices(loadRegisteredDevices());
  }, []);

  // Persist registered devices when they change
  useEffect(() => {
    saveRegisteredDevices(registeredDevices);
  }, [registeredDevices]);

  /** Fetch current ADB server status and connected devices */
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_adb_status' }),
      });
      const data: AdbStatusResponse = await res.json();
      setServerRunning(data.serverRunning);
      setDevices(data.devices || []);
      setLastError(null);
      return data;
    } catch {
      setServerRunning(false);
      setDevices([]);
      return null;
    }
  }, []);

  /** Start ADB server */
  const startServer = useCallback(async () => {
    setIsConnecting(true);
    setLastError(null);
    try {
      const res = await fetch('/api/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start_adb_server' }),
      });
      const data = await res.json();
      if (data.success) {
        setServerRunning(true);
        // After starting, wait a moment then detect devices
        await new Promise(r => setTimeout(r, 1000));
        const status = await fetchStatus();

        // Auto-connect to registered devices with Wi-Fi
        if (status?.devices) {
          const registered = loadRegisteredDevices();
          for (const dev of status.devices) {
            const reg = registered.find(r => r.serial === dev.serial);
            if (reg && reg.autoConnect && reg.connectionType === 'Wi-Fi' && reg.ip && reg.port) {
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
      setIsConnecting(false);
    }
  }, [fetchStatus]);

  /** Stop ADB server */
  const stopServer = useCallback(async () => {
    try {
      await fetch('/api/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop_adb_server' }),
      });
      setServerRunning(false);
      setDevices([]);
    } catch {
      // Ignore errors on stop
    }
  }, []);

  /** Toggle ADB server on/off */
  const toggleServer = useCallback(async () => {
    if (serverRunning) {
      await stopServer();
    } else {
      await startServer();
    }
  }, [serverRunning, startServer, stopServer]);

  /** Connect to a device via IP:port (Wi-Fi ADB) */
  const connectToIp = useCallback(async (ip: string, port: string = '5555') => {
    setLastError(null);
    try {
      const res = await fetch('/api/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'connect_adb', target: `${ip}:${port}` }),
      });
      const data = await res.json();
      if (data.success) {
        // Refresh device list
        await fetchStatus();
        return true;
      } else {
        setLastError(data.error || 'Error al conectar');
        return false;
      }
    } catch {
      setLastError('Error de conexión');
      return false;
    }
  }, [fetchStatus]);

  /** Disconnect a specific device */
  const disconnectDevice = useCallback(async (serial: string) => {
    try {
      await fetch('/api/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disconnect_device', serial }),
      });
      await fetchStatus();
    } catch { /* ignore */ }
  }, [fetchStatus]);

  /** Disconnect all Wi-Fi devices */
  const disconnectAll = useCallback(async () => {
    try {
      await fetch('/api/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'disconnect_device', all: true }),
      });
      await fetchStatus();
    } catch { /* ignore */ }
  }, [fetchStatus]);

  /** Register a device for persistence and auto-connect */
  const registerDevice = useCallback((serial: string, model: string, connectionType: 'USB' | 'Wi-Fi', ip?: string, port?: string) => {
    setRegisteredDevices(prev => {
      const existing = prev.find(d => d.serial === serial);
      if (existing) {
        // Update existing
        return prev.map(d => d.serial === serial ? {
          ...d, model, connectionType, ip: ip || d.ip, port: port || d.port, lastSeen: Date.now(),
        } : d);
      }
      // Add new
      return [...prev, {
        serial, model, connectionType, ip, port,
        lastSeen: Date.now(), autoConnect: connectionType === 'Wi-Fi',
      }];
    });
  }, []);

  /** Unregister a device (stop remembering it) */
  const unregisterDevice = useCallback((serial: string) => {
    setRegisteredDevices(prev => prev.filter(d => d.serial !== serial));
  }, []);

  /** Toggle auto-connect for a registered device */
  const toggleAutoConnect = useCallback((serial: string) => {
    setRegisteredDevices(prev => prev.map(d =>
      d.serial === serial ? { ...d, autoConnect: !d.autoConnect } : d
    ));
  }, []);

  // Poll for device status when server is running
  useEffect(() => {
    if (serverRunning) {
      fetchStatus();
      pollRef.current = setInterval(fetchStatus, POLL_INTERVAL);
    } else {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [serverRunning, fetchStatus]);

  // Auto-reconnect: if a registered Wi-Fi device disappears, try to reconnect
  useEffect(() => {
    if (!serverRunning || devices.length > 0) return;

    const registered = loadRegisteredDevices();
    const wifiDevices = registered.filter(d => d.autoConnect && d.connectionType === 'Wi-Fi' && d.ip && d.port);
    if (wifiDevices.length === 0) return;

    reconnectRef.current = setTimeout(async () => {
      for (const dev of wifiDevices) {
        if (dev.ip && dev.port) {
          await connectToIp(dev.ip, dev.port);
        }
      }
    }, RECONNECT_DELAY);

    return () => {
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
    };
  }, [serverRunning, devices, connectToIp]);

  // Check initial ADB status on mount
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  return {
    // State
    serverRunning,
    devices,
    registeredDevices,
    isConnecting,
    lastError,

    // Actions
    startServer,
    stopServer,
    toggleServer,
    connectToIp,
    disconnectDevice,
    disconnectAll,
    fetchStatus,

    // Device registration
    registerDevice,
    unregisterDevice,
    toggleAutoConnect,
  };
}
