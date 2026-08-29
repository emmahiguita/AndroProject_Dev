'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAppStore } from '@/stores';
import type { DeviceInfo } from '@/features/types';

const POLL_INTERVAL = 4000;

interface UseDevicePollingResult {
  devices: DeviceInfo[];
  device: DeviceInfo | null;
  selectedSerial: string;
  setSelectedSerial: (s: string) => void;
  isScanning: boolean;
  scanRadar: () => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * Polls /api/device every 4s. Returns FULL device data including:
 * - CPU usage, RAM usage, storage, battery, temperature
 * - Android version, model, serial, connection type
 * - Bootloader state, verified boot state
 *
 * Keeps Zustand store in sync with active device details.
 */
export function useDevicePolling(): UseDevicePollingResult {
  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [device, setDevice] = useState<DeviceInfo | null>(null);
  const [selectedSerial, setSelectedSerial] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const storeSetDevice = useAppStore((s) => s.setDevice);
  const storeSetActiveSerial = useAppStore((s) => s.setActiveSerial);
  const selectedRef = useRef(selectedSerial);
  selectedRef.current = selectedSerial;
  const prevDeviceStrRef = useRef<string>('');

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/device', { cache: 'no-store' });
      if (!res.ok) return;
      const data = await res.json();

      // Device list (for selector)
      const devList: DeviceInfo[] = data.devices || [];
      setDevices(devList);

      // Full active device data (CPU, RAM, storage, battery, temp)
      const activeDevice: DeviceInfo | null = data.activeDevice || null;

      if (devList.length > 0) {
        const current = selectedRef.current;
        const active = current && devList.some((d: DeviceInfo) => d.serial === current)
          ? current
          : devList[0].serial;
        setSelectedSerial(active);
        storeSetActiveSerial(active);

        // Use activeDevice if it matches the selected serial, otherwise find in list
        const fullDevice = activeDevice && activeDevice.serial === active
          ? activeDevice
          : devList.find((d: DeviceInfo) => d.serial === active) || devList[0];

        const str = JSON.stringify(fullDevice);
        if (str !== prevDeviceStrRef.current) {
          prevDeviceStrRef.current = str;
          setDevice(fullDevice);
          storeSetDevice(fullDevice);
        }
      } else {
        setDevice(null);
        storeSetDevice(null);
        storeSetActiveSerial(null);
      }
    } catch { /* offline */ }
  }, [storeSetDevice, storeSetActiveSerial]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [refresh]);

  const scanRadar = useCallback(async () => {
    setIsScanning(true);
    try {
      const res = await fetch('/api/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'scan_radar' }),
      });
      const data = await res.json();
      if (data.success) await refresh();
      return;
    } catch { /* ignore */ }
    finally { setIsScanning(false); }
  }, [refresh]);

  // Sync store when user manually changes serial
  const handleSelectSerial = useCallback((s: string) => {
    setSelectedSerial(s);
    storeSetActiveSerial(s);
    const found = devices.find((d) => d.serial === s) || null;
    setDevice(found);
    storeSetDevice(found);
  }, [devices, storeSetActiveSerial, storeSetDevice]);

  return {
    devices,
    device,
    selectedSerial,
    setSelectedSerial: handleSelectSerial,
    isScanning,
    scanRadar,
    refresh,
  };
}
