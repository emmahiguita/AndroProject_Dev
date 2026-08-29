/**
 * useAirPlayServer — React Hook for Managing Native iOS AirPlay Receiver Server
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import type { AirPlayServerStatus } from '@/features/types';

export function useAirPlayServer() {
  const [status, setStatus] = useState<AirPlayServerStatus>({
    running: false,
    port: 7000,
    serverName: 'AndroProject [PC]',
    bonjourActive: false,
    pinRequired: false,
    pinCode: '',
    connectedClients: [],
  });
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/airplay');
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && data.status) {
        setStatus(data.status);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 8000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const toggleServer = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const action = status.running ? 'stop' : 'start';
      const res = await fetch('/api/airplay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          serverName: status.serverName,
          port: status.port,
          pinRequired: status.pinRequired,
          pinCode: status.pinCode,
        }),
      });
      const data = await res.json();
      if (data.success) {
        await fetchStatus();
      } else {
        setError(data.error || 'Error al alternar servidor AirPlay');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [status, fetchStatus]);

  const setServerName = useCallback(async (name: string) => {
    try {
      const res = await fetch('/api/airplay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_name', name }),
      });
      const data = await res.json();
      if (data.success) await fetchStatus();
    } catch {}
  }, [fetchStatus]);

  const setPin = useCallback(async (pin: string) => {
    try {
      const res = await fetch('/api/airplay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'set_pin', pin }),
      });
      const data = await res.json();
      if (data.success) await fetchStatus();
    } catch {}
  }, [fetchStatus]);

  return {
    status,
    loading,
    error,
    toggleServer,
    setServerName,
    setPin,
    refresh: fetchStatus,
  };
}
