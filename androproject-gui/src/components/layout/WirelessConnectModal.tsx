'use client';

import React, { useState } from 'react';
import { Wifi, X } from 'lucide-react';

interface WirelessConnectModalProps {
  open: boolean;
  onClose: () => void;
  onConnected: () => void;
  addLog: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

/**
 * Modal para conectar un dispositivo Android vía Wi-Fi ADB.
 * Desacoplado de page.tsx — recibe callbacks para logging y refresh.
 */
export const WirelessConnectModal: React.FC<WirelessConnectModalProps> = ({
  open, onClose, onConnected, addLog,
}) => {
  const [ip, setIp] = useState('');
  const [port, setPort] = useState('5555');
  const [connecting, setConnecting] = useState(false);

  const handleConnect = async () => {
    if (!ip.trim()) return;
    setConnecting(true);
    const target = `${ip.trim()}:${port.trim() || '5555'}`;
    addLog(`Conectando vía Wi-Fi a ${target}...`, 'info');

    try {
      const res = await fetch('/api/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'connect_adb', target }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        addLog(`${target} conectado.`, 'success');
        onClose();
        setIp('');
        onConnected();
      } else {
        addLog(`Error: ${data.error || 'Timeout'}`, 'error');
      }
    } catch {
      addLog('Fallo de red al conectar.', 'error');
    } finally {
      setConnecting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-4">
      <div className="glow-card rounded-2xl p-6 w-full max-w-md bg-[#0b0e17] border border-white/10 shadow-2xl space-y-5 animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-white font-bold text-base">
            <Wifi size={18} className="text-[#22c97d]" />
            <span>Conectar Dispositivo Wi-Fi</span>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-white/40 hover:text-white hover:bg-white/10">
            <X size={16} />
          </button>
        </div>

        <p className="text-xs text-white/50">
          Ingresa la IP local de tu Android con Depuración Inalámbrica activa.
        </p>

        {/* Fields */}
        <div className="space-y-3">
          <div>
            <label className="text-[10px] uppercase font-bold text-white/40 mb-1 block">Dirección IP</label>
            <input
              type="text"
              placeholder="192.168.0.x"
              value={ip}
              onChange={(e) => setIp(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleConnect(); }}
              className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-[#22c97d]"
              autoFocus
            />
          </div>
          <div>
            <label className="text-[10px] uppercase font-bold text-white/40 mb-1 block">Puerto ADB</label>
            <input
              type="text"
              placeholder="5555"
              value={port}
              onChange={(e) => setPort(e.target.value)}
              className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-[#22c97d]"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2.5 pt-2">
          <button onClick={onClose}
            className="px-4 py-2 rounded-xl bg-white/[0.05] hover:bg-white/10 text-white/70 text-xs font-semibold">
            Cancelar
          </button>
          <button onClick={handleConnect} disabled={connecting || !ip.trim()}
            className="px-5 py-2 rounded-xl bg-[#1bae6e] hover:bg-[#1bae6e]/90 text-slate-950 text-xs font-bold transition-all disabled:opacity-50">
            {connecting ? 'Conectando...' : 'Establecer Conexión'}
          </button>
        </div>
      </div>
    </div>
  );
};
