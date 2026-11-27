'use client';
import { apiUrl } from '@/lib/api-url';

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
  detectionError: string | null;
  discovery: string | null;
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
  const [detectionError, setDetectionError] = useState<string | null>(null);
  const [discovery, setDiscovery] = useState<string | null>(null);
  const storeSetDevice = useAppStore((s) => s.setDevice);
  const storeSetActiveSerial = useAppStore((s) => s.setActiveSerial);
  const storeSetDevicesList = useAppStore((s) => s.setDevicesList);
  const selectedRef = useRef(selectedSerial);
  const prevDeviceStrRef = useRef<string>('');
  const prevListStrRef = useRef<string>('');
  const inFlightRef = useRef<AbortController | null>(null);
  const consecutiveErrorsRef = useRef(0);

  const refresh = useCallback(async () => {
    if (inFlightRef.current) return;
    const controller = new AbortController();
    inFlightRef.current = controller;
    const requestedSerial = selectedRef.current;
    try {
      const url = requestedSerial
        ? `/api/device?serial=${encodeURIComponent(requestedSerial)}`
        : '/api/device';
      const res = await fetch(apiUrl(url), { cache: 'no-store', signal: controller.signal });

      const data = await res.json();

      if (controller.signal.aborted || requestedSerial !== selectedRef.current) return;
      if (!res.ok || data.success === false || !Array.isArray(data.devices))
        throw new Error(data.error || 'Respuesta de detección inválida');
      consecutiveErrorsRef.current = 0;
      setDetectionError(null);

      // Device list (for selector + MultiScreenGrid via Zustand)
      const devList: DeviceInfo[] = data.devices || [];
      const listStr = JSON.stringify(devList.map(({ serial, state, platform, model, connectionType }) => [serial, state, platform, model, connectionType]));
      if (listStr !== prevListStrRef.current) {
        prevListStrRef.current = listStr;
        setDevices(devList);
        storeSetDevicesList(
          devList.map((d) => ({
            serial: d.serial,
            model: d.model || d.serial,
            connectionType: d.connectionType || 'USB',
            state: d.state || 'device',
          }))
        );
      }

      if (requestedSerial !== selectedRef.current) return;

      // Full active device data (CPU, RAM, storage, battery, temp)
      const activeDevice: DeviceInfo | null = data.activeDevice || null;

      if (devList.length > 0) {
        let active = selectedRef.current;
        if (!active && typeof window !== 'undefined') {
          const urlParams = new URLSearchParams(window.location.search);
          const preferIos = urlParams.get('device') === 'ios' || urlParams.get('platform') === 'ios';
          const requestedSerial = urlParams.get('serial');
          if (preferIos) {
            const iosDev = devList.find((d: DeviceInfo) => d.platform === 'ios' || d.serial?.startsWith('airplay-'));
            if (iosDev) active = iosDev.serial;
          } else if (requestedSerial) {
            const match = devList.find((d: DeviceInfo) => d.serial === requestedSerial);
            if (match) active = match.serial;
          }
        }

        if (!active || !devList.some((d: DeviceInfo) => d.serial === active)) {
          active = activeDevice?.serial || devList.find(d => d.state === 'device')?.serial || devList[0].serial;
        }

        selectedRef.current = active;
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
        selectedRef.current = '';
        prevDeviceStrRef.current = '';
        setSelectedSerial('');
        setDevice(null);
        storeSetDevice(null);
        storeSetActiveSerial(null);
      }
    } catch (error) {
      if (controller.signal.aborted || requestedSerial !== selectedRef.current) return;
      consecutiveErrorsRef.current += 1;
      setDetectionError(error instanceof Error ? error.message : 'No se pudo consultar ADB');
      // Tolera hasta 2 fallos transitorios de ADB sin desmontar la pantalla ni perder el estado.
      if (consecutiveErrorsRef.current < 3) return;
      prevDeviceStrRef.current = '';
      prevListStrRef.current = '';
      setDevices([]); setDevice(null); setSelectedSerial('');
      storeSetDevicesList([]); storeSetDevice(null); storeSetActiveSerial(null);
    } finally { if (inFlightRef.current === controller) inFlightRef.current = null; }
  }, [storeSetDevice, storeSetActiveSerial, storeSetDevicesList]);

  useEffect(() => {
    refresh();
    const pollIfVisible = () => { if (!document.hidden) void refresh(); };
    const interval = setInterval(pollIfVisible, POLL_INTERVAL);
    document.addEventListener('visibilitychange', pollIfVisible);
    return () => {
      inFlightRef.current?.abort();
      inFlightRef.current = null;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', pollIfVisible);
    };
  }, [refresh]);

  const scanRadar = useCallback(async () => {
    setIsScanning(true);
    try {
      const res = await fetch(apiUrl('/api/actions'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'scan_radar' }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Falló la búsqueda inalámbrica');
      const services: string[] = data.services;
      setDiscovery(services.length ? services.join(' · ') : 'ADB no encontró servicios inalámbricos anunciados.');
      await refresh();
    } catch (error) { setDiscovery(error instanceof Error ? error.message : 'Error de red'); }
    finally { setIsScanning(false); }
  }, [refresh]);

  // Sync store when user manually changes serial
  const handleSelectSerial = useCallback((s: string) => {
    selectedRef.current = s;
    prevDeviceStrRef.current = '';
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
    isScanning, detectionError, discovery,
    scanRadar,
    refresh,
  };
}
