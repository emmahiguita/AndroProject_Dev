// ============================================================================
// ARCHIVO: EmptyState.tsx
// QUÉ HACE: Renderiza el estado vacío de Proyección con formulario ADB Wi-Fi
//           directo y escáner Radar de red local.
// CÓMO FUNCIONA: Conecta `onConnectAdb` y `POST /api/actions` (`radar`) con
//           tipografía e iconos monocromos de alto contraste.
// POR QUÉ: Eliminar `text-white/25` y `text-white/40` no legibles (< 200L).
// ============================================================================
'use client';

import React, { useState } from 'react';
import { Smartphone, Wifi, Usb, Radar, Loader2, ArrowRight } from 'lucide-react';

interface EmptyStateProps {
  dark: boolean;
  onConnectAdb?: (ip: string, port?: string) => Promise<{ success: boolean; message?: string }>;
  isConnecting?: boolean;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ dark, onConnectAdb, isConnecting = false }) => {
  const [ip, setIp] = useState('');
  const [port, setPort] = useState('5555');
  const [status, setStatus] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [discoveredIps, setDiscoveredIps] = useState<string[]>([]);

  const handleConnect = async (targetIp?: string) => {
    const connectIp = targetIp || ip;
    if (!connectIp.trim() || !onConnectAdb) return;
    setStatus(null);
    const res = await onConnectAdb(connectIp, port);
    setStatus(res.message || (res.success ? 'Conectado exitosamente' : 'Error al conectar'));
  };

  const handleScanRadar = async () => {
    setIsScanning(true);
    setStatus('Escaneando red local en busca de dispositivos Android...');
    setDiscoveredIps([]);
    try {
      const res = await fetch('/api/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'radar' }),
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.devices) && data.devices.length > 0) {
        const ips = data.devices.map((d: any) => d.ip || d).filter(Boolean);
        setDiscoveredIps(ips);
        setStatus(`Se encontraron ${ips.length} dispositivo(s) en la red.`);
      } else {
        setStatus(data.message || 'No se encontraron dispositivos con puerto 5555 abierto.');
      }
    } catch {
      setStatus('Error al escanear la red.');
    } finally {
      setIsScanning(false);
    }
  };

  const mutedCls = dark ? 'text-zinc-400' : 'text-slate-600';
  const inputCls = dark
    ? 'bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-400'
    : 'bg-white border-slate-300 text-slate-900 placeholder:text-slate-400 focus:border-slate-600';

  return (
    <div className="flex flex-col items-center justify-center h-full text-center gap-5 px-4 max-w-md mx-auto">
      <div className={`relative w-16 h-16 rounded-2xl flex items-center justify-center border ${
        dark ? 'bg-zinc-900 border-zinc-800 text-zinc-300' : 'bg-slate-100 border-slate-200 text-slate-700'
      }`}>
        <Smartphone size={28} />
      </div>

      <div>
        <h2 className={`text-base font-bold mb-1 ${dark ? 'text-zinc-100' : 'text-slate-900'}`}>
          Sin dispositivo conectado
        </h2>
        <p className={`text-xs max-w-[320px] ${mutedCls}`}>
          Conecta tu Android vía cable USB con Depuración activa o ingresa la IP para control inalámbrico.
        </p>
      </div>

      {onConnectAdb && (
        <div className="flex flex-col items-center gap-2.5 w-full">
          <div className="flex items-center gap-2 w-full">
            <input
              type="text"
              placeholder="IP (Ej: 192.168.1.150)"
              value={ip}
              onChange={(e) => setIp(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleConnect(); }}
              className={`flex-1 py-2 px-3 rounded-xl text-xs border font-mono outline-none ${inputCls}`}
            />
            <input
              type="text"
              placeholder="5555"
              value={port}
              onChange={(e) => setPort(e.target.value)}
              className={`w-16 py-2 px-2 rounded-xl text-xs border font-mono text-center outline-none ${inputCls}`}
            />
            <button
              type="button"
              onClick={() => handleConnect()}
              disabled={isConnecting || !ip.trim()}
              className="px-3.5 py-2 rounded-xl bg-zinc-100 hover:bg-white text-zinc-950 text-xs font-bold transition-all disabled:opacity-40 flex items-center gap-1.5 shrink-0 cursor-pointer"
            >
              {isConnecting ? <Loader2 size={12} className="animate-spin" /> : <Wifi size={12} />}
              <span>{isConnecting ? 'Conectando' : 'Conectar'}</span>
            </button>
          </div>

          <button
            type="button"
            onClick={handleScanRadar}
            disabled={isScanning}
            className={`w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
              dark
                ? 'bg-zinc-900 border-zinc-800 text-zinc-200 hover:bg-zinc-800'
                : 'bg-slate-100 border-slate-300 text-slate-800 hover:bg-slate-200'
            }`}
          >
            {isScanning ? <Loader2 size={12} className="animate-spin" /> : <Radar size={12} />}
            <span>{isScanning ? 'Escaneando red local (Radar)...' : 'Escanear Red Local (Radar ADB)'}</span>
          </button>

          {discoveredIps.length > 0 && (
            <div className={`w-full space-y-1.5 p-2.5 rounded-xl border text-left ${dark ? 'bg-zinc-900 border-zinc-800' : 'bg-slate-50 border-slate-200'}`}>
              <span className={`text-[11px] font-bold block px-1 ${dark ? 'text-zinc-200' : 'text-slate-800'}`}>
                Dispositivos detectados en la red:
              </span>
              <div className="flex flex-col gap-1">
                {discoveredIps.map((discoveredIp) => (
                  <button
                    key={discoveredIp}
                    type="button"
                    onClick={() => { setIp(discoveredIp); handleConnect(discoveredIp); }}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-mono border transition-all cursor-pointer ${
                      dark
                        ? 'bg-zinc-950 border-zinc-800 text-zinc-100 hover:bg-zinc-800'
                        : 'bg-white border-slate-200 text-slate-900 hover:bg-slate-100'
                    }`}
                  >
                    <span>{discoveredIp}:5555</span>
                    <span className="flex items-center gap-1 text-[11px] font-sans font-bold">
                      Conectar <ArrowRight size={11} />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {status && (
            <p className={`text-xs font-medium ${dark ? 'text-zinc-200' : 'text-slate-800'}`}>
              {status}
            </p>
          )}
        </div>
      )}

      <div className="flex items-center gap-4 pt-2">
        <div className="flex items-center gap-1.5">
          <div className={`p-1.5 rounded-lg border ${dark ? 'bg-zinc-900 border-zinc-800 text-zinc-300' : 'bg-slate-100 border-slate-200 text-slate-700'}`}>
            <Usb size={12} />
          </div>
          <span className={`text-xs font-medium ${mutedCls}`}>USB Automático</span>
        </div>
        <div className={`w-px h-3 ${dark ? 'bg-zinc-800' : 'bg-slate-300'}`} />
        <div className="flex items-center gap-1.5">
          <div className={`p-1.5 rounded-lg border ${dark ? 'bg-zinc-900 border-zinc-800 text-zinc-300' : 'bg-slate-100 border-slate-200 text-slate-700'}`}>
            <Wifi size={12} />
          </div>
          <span className={`text-xs font-medium ${mutedCls}`}>Wi-Fi ADB (5555)</span>
        </div>
      </div>
    </div>
  );
};
