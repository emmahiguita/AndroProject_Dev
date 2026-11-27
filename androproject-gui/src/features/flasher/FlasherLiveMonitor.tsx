// ============================================================================
// ARCHIVO: flasher/FlasherLiveMonitor.tsx
// QUÉ HACE: Monitor visual en vivo y control rápido de Modo Desarrollador
//           integrado dentro de la vista Flasheador / Bootloader (BIOS).
// CÓMO FUNCIONA: En modo ADB muestra la pantalla real en vivo (`/api/device-image`
//           con auto-refresco + botón de transmisión fluida scrcpy + activación
//           automática de Modo Desarrollador); en Fastboot/Recovery muestra la
//           telemetría real del bootloader sin simular video inexistente.
// POR QUÉ: Observar el dispositivo y activar Modo Desarrollador sin salir de
//          la vista de bajo nivel (< 120 líneas, SRP).
// ============================================================================
'use client';

import React, { useEffect, useState } from 'react';
import { MonitorPlay, Power, RefreshCw, Terminal } from 'lucide-react';
import { apiUrl } from '@/lib/api-url';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface FlasherLiveMonitorProps {
  dark: boolean;
  serial: string | null;
  flashState: string;
  flashInfo: Record<string, unknown>;
  onLog: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

export const FlasherLiveMonitor: React.FC<FlasherLiveMonitorProps> = ({
  dark, serial, flashState, flashInfo, onLog,
}) => {
  const [livePreview, setLivePreview] = useState(false);
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState(false);

  const isAdb = flashState === 'adb';
  const isRecovery = flashState === 'recovery' || flashState === 'sideload';
  const canStream = isAdb || isRecovery;

  useEffect(() => {
    if (!livePreview || !serial || !canStream) return;
    const id = setInterval(() => setTick((t) => t + 1), 1500);
    return () => clearInterval(id);
  }, [livePreview, serial, canStream]);

  const callAction = async (action: string, extra: Record<string, unknown> = {}) => {
    if (!serial) return;
    setBusy(true);
    try {
      const r = await fetch(apiUrl('/api/actions'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, serial, ...extra }),
      });
      const d = await r.json();
      onLog(d.message || d.error || action, d.success ? 'success' : 'error');
    } catch { onLog(`Error ejecutando ${action}`, 'error'); }
    finally { setBusy(false); }
  };

  const mutedCls = dark ? 'text-zinc-400' : 'text-slate-600';
  const boxCls = dark ? 'bg-zinc-900/70 border-zinc-800' : 'bg-slate-50 border-slate-200';

  return (
    <Card padding="md" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-xs font-bold flex items-center gap-1.5">
            <MonitorPlay size={14} /> Monitor en Vivo y Modo Desarrollador (Vista Bootloader / Recovery / BIOS)
          </h3>
          <p className={`text-[11px] ${mutedCls}`}>
            {isAdb
              ? 'Modo Android/ADB: transmisión en vivo (scrcpy o framebuffer) + activación de Modo Desarrollador.'
              : isRecovery
              ? 'Modo Recovery/Booteable: intenta capturar framebuffer real vía ADB (compatible con TWRP/OrangeFox) + telemetría.'
              : 'En Fastboot puro (BIOS), el firmware no emite video USB; se muestra telemetría real en vivo del bootloader.'}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" variant="primary" icon={<Power size={12} />} disabled={!serial || !isAdb || busy} onClick={() => callAction('auto_activate_dev_mode')}>
            Activar Modo Desarrollador
          </Button>
          <Button size="sm" variant="secondary" icon={<MonitorPlay size={12} />} disabled={!serial || !isAdb || busy} onClick={() => callAction('open_screen')}>
            Transmisión scrcpy
          </Button>
          <Button size="sm" variant={livePreview ? 'primary' : 'secondary'} icon={<RefreshCw size={12} />} disabled={!serial || !canStream} onClick={() => { setLivePreview((v) => !v); setTick((t) => t + 1); }}>
            {livePreview ? 'Pausar vista' : isRecovery ? 'Capturar Recovery' : 'Ver pantalla aquí'}
          </Button>
        </div>
      </div>

      {canStream && livePreview && serial && (
        <div className={`rounded-xl border p-2 flex flex-col items-center gap-1 ${boxCls}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={apiUrl(`/api/device-image?serial=${encodeURIComponent(serial)}&t=${tick}`)}
            alt="Transmisión en vivo del dispositivo Android"
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              const nw = e.currentTarget.naturalWidth || 1080;
              const nh = e.currentTarget.naturalHeight || 2400;
              const x = Math.round(((e.clientX - r.left) / Math.max(1, r.width)) * nw);
              const y = Math.round(((e.clientY - r.top) / Math.max(1, r.height)) * nh);
              void callAction('input_tap', { x, y }).then(() => setTimeout(() => setTick((t) => t + 1), 350));
            }}
            className="max-h-[420px] rounded-lg object-contain border border-zinc-800 cursor-crosshair select-none"
          />
          <span className={`text-[10px] font-mono ${mutedCls}`}>Haz clic sobre la imagen para tocar el teléfono en tiempo real</span>
        </div>
      )}
      {!isAdb && (
        <div className={`rounded-xl border p-3 font-mono text-[11px] space-y-1 ${boxCls}`}>
          <div className="flex items-center gap-1.5 font-semibold"><Terminal size={12} /> Telemetría Bootloader / Recovery en tiempo real</div>
          <div>Estado: <strong>{flashState || 'desconocido'}</strong> · Serial: <strong>{serial || '--'}</strong></div>
          <pre className={`whitespace-pre-wrap break-all ${mutedCls}`}>{JSON.stringify(flashInfo, null, 2)}</pre>
        </div>
      )}
    </Card>
  );
};
