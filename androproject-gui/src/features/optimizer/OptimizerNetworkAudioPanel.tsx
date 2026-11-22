// ============================================================================
// ARCHIVO: OptimizerNetworkAudioPanel.tsx
// QUÉ HACE: Panel de Red, DNS Privado/AdGuard, Túnel DNS (`dns2tcp`), Códecs
//           Bluetooth A2DP de Desarrollador y Estilo de Panel de Notificaciones.
// CÓMO FUNCIONA: Conecta todas las propiedades y setters de `optimizerSlice.ts`
//           con las acciones de `/api/actions` (`set_adguard_dns`, `set_private_dns`,
//           `set_wifi_scan_interval`, `set_wifi_power_save`, `dns_tunnel_*`,
//           `set_bluetooth_codec`, `set_bluetooth_absolute_volume`, `set_shade_style`).
// POR QUÉ: Eliminar todos los setters y endpoints huérfanos de `optimizerSlice` (<200L).
// ============================================================================
'use client';

import React, { useState } from 'react';
import { Wifi, Globe, Radio, Volume2, Bell, Play, Square } from 'lucide-react';
import { useAppStore } from '@/stores';
import { useTheme } from '@/hooks/useTheme';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import type { AdguardProfile } from '@/stores/optimizerSlice';

interface OptimizerNetworkAudioPanelProps {
  serial: string | null;
  mode: 'network' | 'audio';
  addLog: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

export const OptimizerNetworkAudioPanel: React.FC<OptimizerNetworkAudioPanelProps> = ({
  serial, mode, addLog,
}) => {
  const { dark } = useTheme();
  const s = useAppStore();
  const [busy, setBusy] = useState(false);

  const postAction = async (action: string, payload: Record<string, unknown> = {}) => {
    if (!serial) { addLog('Conecta un dispositivo Android por ADB.', 'error'); return null; }
    setBusy(true);
    try {
      const r = await fetch('/api/actions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, serial, ...payload }),
      });
      const d = await r.json();
      addLog(d.message || d.error || action, d.success ? 'success' : 'error');
      return d;
    } catch {
      addLog(`Error de red ejecutando ${action}`, 'error');
      return null;
    } finally {
      setBusy(false);
    }
  };

  const chipCls = (active: boolean) =>
    `px-2.5 py-1 rounded border text-[11px] font-mono font-semibold transition-colors cursor-pointer disabled:opacity-50 ${
      active
        ? dark ? 'bg-zinc-100 text-zinc-950 border-zinc-100' : 'bg-slate-900 text-white border-slate-900'
        : dark ? 'bg-zinc-900 text-zinc-300 border-zinc-700 hover:bg-zinc-800' : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
    }`;
  const rowCls = `flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg border ${
    dark ? 'bg-zinc-900/60 border-zinc-800' : 'bg-slate-50 border-slate-200'
  }`;
  const inputCls = `px-2.5 py-1 rounded border text-xs font-mono ${
    dark ? 'bg-zinc-900 border-zinc-700 text-zinc-100' : 'bg-white border-slate-300 text-slate-900'
  }`;

  if (mode === 'network') {
    return (
      <div className="space-y-3">
        <Card padding="md" className="space-y-2.5">
          <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5"><Globe size={13} /> Escudo AdGuard DNS &amp; DNS Privado</h3>
          <div className={rowCls}>
            <span className="text-xs font-semibold">Perfil AdGuard DNS</span>
            <div className="flex flex-wrap gap-1">
              {([
                { id: 'off', label: 'Desactivado' },
                { id: 'default', label: 'Anti-Anuncios' },
                { id: 'family', label: 'Familiar' },
                { id: 'nonfiltering', label: 'Sin Filtro' },
              ] as { id: AdguardProfile; label: string }[]).map((p) => (
                <button key={p.id} type="button" disabled={!serial || busy} onClick={() => { s.setAdguardProfile(p.id); postAction('set_adguard_dns', { profile: p.id }); }} className={chipCls(s.adguardProfile === p.id)}>{p.label}</button>
              ))}
            </div>
          </div>

          <div className={rowCls}>
            <span className="text-xs font-semibold">DNS Privado Personalizado ({s.privateDnsMode})</span>
            <div className="flex flex-wrap items-center gap-1.5">
              <input type="text" placeholder="dns.google / one.one.one.one" value={s.privateDnsSpecifier} onChange={(e) => s.setPrivateDnsSpecifier(e.target.value)} className={inputCls} />
              <button type="button" disabled={!serial || busy || !s.privateDnsSpecifier.trim()} onClick={() => { s.setPrivateDnsMode('hostname'); postAction('set_private_dns', { mode: 'hostname', hostname: s.privateDnsSpecifier.trim() }); }} className={chipCls(s.privateDnsMode === 'hostname')}>Aplicar Host</button>
              <button type="button" disabled={!serial || busy} onClick={() => { s.setPrivateDnsMode('automatic'); postAction('set_private_dns', { mode: 'automatic' }); }} className={chipCls(s.privateDnsMode === 'automatic')}>Auto</button>
            </div>
          </div>
        </Card>

        <Card padding="md" className="space-y-2.5">
          <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5"><Wifi size={13} /> Optimización de Radio Wi-Fi</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div className={rowCls}>
              <span className="text-xs font-semibold">Intervalo escaneo Wi-Fi</span>
              <div className="flex gap-1">
                {[{ label: 'Sin límite', ms: 0 }, { label: '15s', ms: 15000 }, { label: '30s', ms: 30000 }, { label: '60s', ms: 60000 }].map((i) => (
                  <button key={i.ms} type="button" disabled={!serial || busy} onClick={() => { s.setWifiScanInterval(i.ms); postAction('set_wifi_scan_interval', { interval: i.ms }); }} className={chipCls(s.wifiScanInterval === i.ms)}>{i.label}</button>
                ))}
              </div>
            </div>
            <div className={rowCls}>
              <span className="text-xs font-semibold">Ahorro de energía Wi-Fi</span>
              <button type="button" disabled={!serial || busy} onClick={() => { const next = !s.wifiPowerSave; s.setWifiPowerSave(next); postAction('set_wifi_power_save', { enabled: next }); }} className={chipCls(s.wifiPowerSave)}>
                {s.wifiPowerSave ? 'ACTIVO' : 'INACTIVO'}
              </button>
            </div>
          </div>
        </Card>

        <Card padding="md" className="space-y-2.5">
          <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5"><Radio size={13} /> Túnel DNS sobre Android (dns2tcp SOCKS5 :2080)</h3>
          <div className="flex flex-wrap items-center gap-2">
            <input type="text" placeholder="Dominio túnel (ej. t.ejemplo.com)" value={s.dnsTunnelDomain} onChange={(e) => s.setDnsTunnelDomain(e.target.value)} className={`flex-1 ${inputCls}`} />
            <input type="text" placeholder="Clave / Recurso" value={s.dnsTunnelKey} onChange={(e) => s.setDnsTunnelKey(e.target.value)} className={`w-40 ${inputCls}`} />
            <Button size="sm" variant="secondary" disabled={!serial || busy || !s.dnsTunnelDomain || !s.dnsTunnelKey} onClick={() => postAction('dns_tunnel_setup', { domain: s.dnsTunnelDomain, key: s.dnsTunnelKey })}>Configurar</Button>
            <Button size="sm" icon={<Play size={12} />} disabled={!serial || busy} onClick={async () => { const d = await postAction('dns_tunnel_start'); if (d?.success) { s.setDnsTunnelRunning(true); s.setDnsTunnelProxy('127.0.0.1:2080'); } }}>Iniciar</Button>
            <Button size="sm" variant="secondary" icon={<Square size={12} />} disabled={!serial || busy} onClick={async () => { const d = await postAction('dns_tunnel_stop'); if (d?.success) { s.setDnsTunnelRunning(false); s.setDnsTunnelProxy(':0'); } }}>Detener</Button>
            <Button size="sm" variant="secondary" disabled={!serial || busy} onClick={async () => { const d = await postAction('dns_tunnel_status'); if (d) { s.setDnsTunnelRunning(Boolean(d.running)); s.setDnsTunnelProxy(d.proxy || ''); } }}>Estado</Button>
          </div>
          <p className="text-[11px] font-mono text-text-secondary">
            Estado: <strong>{s.dnsTunnelRunning ? 'EN EJECUCIÓN' : 'DETENIDO'}</strong> · Proxy: <strong>{s.dnsTunnelProxy || 'ninguno'}</strong>
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <Card padding="md" className="space-y-2.5">
        <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5"><Volume2 size={13} /> Audio Bluetooth A2DP (Opciones de Desarrollador)</h3>
        <div className={rowCls}>
          <span className="text-xs font-semibold">Códec de audio Bluetooth</span>
          <div className="flex flex-wrap gap-1">
            {(['sbc', 'aac', 'aptx', 'aptx_hd', 'ldac', 'lhdc'] as const).map((c) => (
              <button key={c} type="button" disabled={!serial || busy} onClick={() => { s.setBluetoothInfo((p) => ({ ...p, codec: c })); postAction('set_bluetooth_codec', { codec: c }); }} className={chipCls(s.bluetoothInfo.codec === c)}>{c.toUpperCase()}</button>
            ))}
          </div>
        </div>
        <div className={rowCls}>
          <span className="text-xs font-semibold">Desactivar volumen absoluto Bluetooth</span>
          <button
            type="button"
            disabled={!serial || busy}
            onClick={() => {
              const dis = s.bluetoothInfo.disableAbsoluteVolume === 'true' ? '0' : '1';
              s.setBluetoothInfo((p) => ({ ...p, disableAbsoluteVolume: dis === '1' ? 'true' : 'false' }));
              postAction('set_bluetooth_absolute_volume', { disable: dis });
            }}
            className={chipCls(s.bluetoothInfo.disableAbsoluteVolume === 'true')}
          >
            {s.bluetoothInfo.disableAbsoluteVolume === 'true' ? 'DESACTIVADO (Control independiente)' : 'VOLUMEN ABSOLUTO ACTIVO'}
          </button>
        </div>
      </Card>

      <Card padding="md" className="space-y-2.5">
        <h3 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5"><Bell size={13} /> Panel de Notificaciones, Tipografía y Modo Noche</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          <div className={rowCls}>
            <span className="text-xs font-semibold">Texto de alto contraste</span>
            <button type="button" disabled={!serial || busy} onClick={() => { const next = !s.shadeHighContrast; s.setShadeHighContrast(next); postAction('set_shade_style', { highContrast: next }); }} className={chipCls(s.shadeHighContrast)}>{s.shadeHighContrast ? 'ACTIVO' : 'NORMAL'}</button>
          </div>
          <div className={rowCls}>
            <span className="text-xs font-semibold">Reducir desenfoque del panel (Sin Blur)</span>
            <button type="button" disabled={!serial || busy} onClick={() => { const next = !s.shadeReduceBlur; s.setShadeReduceBlur(next); postAction('set_shade_style', { reduceBlur: next }); }} className={chipCls(s.shadeReduceBlur)}>{s.shadeReduceBlur ? 'SIN BLUR' : 'CON BLUR'}</button>
          </div>
          <div className={rowCls}>
            <span className="text-xs font-semibold">Tipografía resaltada (Escala 1.1x)</span>
            <button type="button" disabled={!serial || busy} onClick={() => { const next = !s.shadeBoldText; s.setShadeBoldText(next); postAction('set_shade_style', { boldText: next }); }} className={chipCls(s.shadeBoldText)}>{s.shadeBoldText ? '1.1x ACTIVO' : '1.0x ESTÁNDAR'}</button>
          </div>
          <div className={rowCls}>
            <span className="text-xs font-semibold">Modo Noche / Tema Oscuro del Sistema</span>
            <div className="flex gap-1">
              {[{ id: '1', label: 'Claro' }, { id: '2', label: 'Oscuro' }, { id: '0', label: 'Auto' }].map((m) => (
                <button key={m.id} type="button" disabled={!serial || busy} onClick={() => { s.setNightMode(m.id); postAction('set_night_mode', { mode: m.id }); }} className={chipCls(s.nightMode === m.id)}>{m.label}</button>
              ))}
            </div>
          </div>
          <div className={rowCls}>
            <span className="text-xs font-semibold">Brillo automático adaptativo</span>
            <button type="button" disabled={!serial || busy} onClick={() => { const next = !s.autoBrightness; s.setAutoBrightness(next); postAction('set_auto_brightness', { enabled: next }); }} className={chipCls(s.autoBrightness)}>{s.autoBrightness ? 'AUTO ON' : 'MANUAL'}</button>
          </div>
          <div className={rowCls}>
            <span className="text-xs font-semibold">Animaciones rápidas del panel</span>
            <button type="button" disabled={!serial || busy} onClick={() => { const next = !s.shadeFastAnims; s.setShadeFastAnims(next); postAction('set_shade_style', { animationsFast: next, solidTheme: s.shadeSolidTheme }); }} className={chipCls(s.shadeFastAnims)}>{s.shadeFastAnims ? '0.5x RÁPIDO' : '1.0x NORMAL'}</button>
          </div>
        </div>
      </Card>
    </div>
  );
};
