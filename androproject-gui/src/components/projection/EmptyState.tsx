// ── EmptyState — no device connected ────────────────────────
// SRP: renders the empty state when no device is connected.
// Integrated with direct Wi-Fi ADB input and Local Network Radar Scanner.

'use client';

import React, { useState } from 'react';
import { Smartphone, Wifi, Usb, Radar, Loader2, CheckCircle2, ArrowRight } from 'lucide-react';

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
      } else if (data.message) {
        setStatus(data.message);
      } else {
        setStatus('No se encontraron dispositivos con puerto 5555 abierto.');
      }
    } catch {
      setStatus('Error al escanear la red.');
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full text-center gap-5 px-4 max-w-md mx-auto">
      {/* Animated phone icon */}
      <div className={`relative w-20 h-20 rounded-2xl flex items-center justify-center ${
        dark
          ? 'bg-gradient-to-br from-white/[0.04] to-white/[0.01] border border-white/[0.06]'
          : 'bg-gradient-to-br from-slate-50 to-slate-100 border border-slate-200 shadow-sm'
      }`}>
        <Smartphone size={32} className={dark ? 'text-white/20' : 'text-slate-300'} />
        {/* Pulsing ring */}
        <div className={`absolute inset-0 rounded-2xl border-2 ${
          dark ? 'border-zinc-700' : 'border-zinc-300'
        } animate-ping opacity-30`} />
      </div>

      <div>
        <h2 className={`text-base font-bold mb-1 ${dark ? 'text-white' : 'text-slate-800'}`}>
          Sin dispositivo conectado
        </h2>
        <p className={`text-xs max-w-[320px] ${dark ? 'text-white/40' : 'text-slate-500'}`}>
          Conecta tu Android vía cable USB con Depuración activa o ingresa la IP para control inalámbrico.
        </p>
      </div>

      {/* Inline ADB Connect form */}
      {onConnectAdb && (
        <div className="flex flex-col items-center gap-2.5 w-full">
          <div className="flex items-center gap-2 w-full">
            <input
              type="text"
              placeholder="IP (Ej: 192.168.1.150)"
              value={ip}
              onChange={(e) => setIp(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleConnect(); }}
              className={`flex-1 py-2 px-3 rounded-xl text-xs border font-mono ${
                dark
                  ? 'bg-white/[0.04] border-white/10 text-white placeholder:text-white/25 focus:border-zinc-500'
                  : 'bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400'
              } outline-none`}
            />
            <input
              type="text"
              placeholder="5555"
              value={port}
              onChange={(e) => setPort(e.target.value)}
              className={`w-16 py-2 px-2 rounded-xl text-xs border font-mono text-center ${
                dark
                  ? 'bg-white/[0.04] border-white/10 text-white placeholder:text-white/25'
                  : 'bg-slate-50 border-slate-200 text-slate-800 placeholder:text-slate-400'
              } outline-none`}
            />
            <button
              type="button"
              onClick={() => handleConnect()}
              disabled={isConnecting || !ip.trim()}
              className="px-3.5 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-900 text-xs font-bold transition-all disabled:opacity-40 flex items-center gap-1.5 shrink-0"
            >
              {isConnecting ? <Loader2 size={12} className="animate-spin" /> : <Wifi size={12} />}
              <span>{isConnecting ? 'Conectando' : 'Conectar'}</span>
            </button>
          </div>

          {/* Radar Scanner Button */}
          <button
            type="button"
            onClick={handleScanRadar}
            disabled={isScanning}
            className={`w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
              dark
                ? 'bg-white/[0.02] border-white/10 text-white/70 hover:bg-white/[0.06] hover:text-white'
                : 'bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100'
            }`}
          >
            {isScanning ? <Loader2 size={12} className="animate-spin text-zinc-400" /> : <Radar size={12} className="text-zinc-400" />}
            <span>{isScanning ? 'Escaneando red local (Radar)...' : 'Escanear Red Local (Radar ADB)'}</span>
          </button>

          {/* Discovered IPs list */}
          {discoveredIps.length > 0 && (
            <div className="w-full space-y-1.5 p-2 rounded-xl bg-zinc-900/60 border border-zinc-800 text-left animate-in fade-in duration-200">
              <span className="text-[10px] font-bold text-zinc-300 block px-1">
                Dispositivos detectados en la red:
              </span>
              <div className="flex flex-col gap-1">
                {discoveredIps.map((discoveredIp) => (
                  <button
                    key={discoveredIp}
                    type="button"
                    onClick={() => {
                      setIp(discoveredIp);
                      handleConnect(discoveredIp);
                    }}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-mono border transition-all ${
                      dark
                        ? 'bg-black/40 border-white/5 text-white hover:bg-zinc-800 hover:border-zinc-700'
                        : 'bg-white border-slate-200 text-slate-800 hover:bg-zinc-100'
                    }`}
                  >
                    <span>{discoveredIp}:5555</span>
                    <span className="flex items-center gap-1 text-[10px] text-zinc-300 font-sans font-bold">
                      Conectar <ArrowRight size={10} />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {status && (
            <p className={`text-[11px] font-medium ${
              status.includes('Error') || status.includes('falló') || status.includes('No se encontraron')
                ? 'text-red-400'
                : 'text-emerald-500'
            }`}>
              {status}
            </p>
          )}
        </div>
      )}

      {/* Connection hints */}
      <div className="flex items-center gap-4 pt-2">
        <div className="flex items-center gap-1.5">
          <div className={`p-1.5 rounded-lg ${dark ? 'bg-white/5' : 'bg-slate-100'}`}>
            <Usb size={12} className={dark ? 'text-white/40' : 'text-slate-500'} />
          </div>
          <span className={`text-[10px] font-medium ${dark ? 'text-white/40' : 'text-slate-500'}`}>USB Automático</span>
        </div>
        <div className={`w-px h-3 ${dark ? 'bg-white/10' : 'bg-slate-200'}`} />
        <div className="flex items-center gap-1.5">
          <div className={`p-1.5 rounded-lg ${dark ? 'bg-white/5' : 'bg-slate-100'}`}>
            <Wifi size={12} className={dark ? 'text-white/40' : 'text-slate-500'} />
          </div>
          <span className={`text-[10px] font-medium ${dark ? 'text-white/40' : 'text-slate-500'}`}>Wi-Fi ADB (5555)</span>
        </div>
      </div>
    </div>
  );
};
