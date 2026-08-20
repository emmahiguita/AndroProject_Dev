'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import {
  Settings, FolderOpen, HardDrive, Monitor, Zap, Camera,
  Wifi, Globe, Radio, Code, Sparkles, Copy, Check, Wrench, ChevronRight,
} from 'lucide-react';
import { useAppStore } from '@/stores';
import { useTheme } from '@/hooks/useTheme';
import { ViewShell } from '@/components/ViewShell';
import { Card } from '@/components/ui/Card';

interface ConfigViewProps {
  addLog?: (msg: string, type?: 'info' | 'success' | 'error') => void;
}

export function ConfigView({ addLog }: ConfigViewProps = {}) {
  const { t, dark } = useTheme();
  const configData = useAppStore((s) => s.configData);
  const setActiveNav = useAppStore((s) => s.setActiveNav);

  const resetConfig = async () => {
    try {
      addLog?.('Recargando configuración del dispositivo...');
      const res = await fetch('/api/config', {
        method: 'POST',
        body: JSON.stringify({ action: 'reset' }),
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (data.message) useAppStore.setState({ configData: data.message });
      addLog?.('✓ Configuración recargada.');
    } catch {
      addLog?.('✗ Error al recargar configuración.');
    }
  };

  return (
    <ViewShell navId="config">
      <div className="mx-auto w-full min-w-0 max-w-4xl space-y-3">
        {/* Header */}
        <div className={`${dark ? 'settings-panel' : `${t.panel} border ${t.border} shadow-sm`} rounded-xl px-4 py-3`}>
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${dark ? 'bg-[#1bae6e]/15 text-[#22c97d]' : 'bg-emerald-100 text-emerald-600'}`}>
              <Settings size={14} />
            </div>
            <div>
              <h2 className={`text-xs font-bold ${t.text}`}>Ajustes del sistema</h2>
              <p className={`text-[10px] ${t.textSub}`}>Información técnica.</p>
            </div>
          </div>
        </div>

        {/* System paths */}
        <Card heading={<span className="flex items-center gap-1.5"><FolderOpen size={10} /> Rutas del sistema</span>}>
          <div className="space-y-0.5">
            <ConfigRow dark={dark} icon={<HardDrive size={12} />} label="Binario ADB" value={configData.adb || 'No configurado'} />
            <ConfigRow dark={dark} icon={<Monitor size={12} />} label="Motor de transmisión" value={configData.streamingEngine || 'No configurado'} />
            <ConfigRow dark={dark} icon={<Zap size={12} />} label="Fastboot" value={configData.fastboot || 'No configurado'} />
            <ConfigRow dark={dark} icon={<HardDrive size={12} />} label="Directorio raíz" value={configData.home || 'No configurado'} />
            <ConfigRow dark={dark} icon={<Camera size={12} />} label="Capturas" value={configData.capturesDir || 'No configurado'} />
          </div>
        </Card>

        {/* Network & ports */}
        <Card heading={<span className="flex items-center gap-1.5"><Wifi size={10} /> Red y puertos</span>}>
          <div className="space-y-0.5">
            <ConfigRow dark={dark} icon={<Wifi size={12} />} label="Puerto Wi-Fi (ADB)" value={String(configData.wifiPort || 5555)} />
            <ConfigRow dark={dark} icon={<Globe size={12} />} label="Puerto API" value={String(configData.apiPort || 3001)} />
            <ConfigRow dark={dark} icon={<Radio size={12} />} label="Puerto WebSocket" value={String(configData.streamingWsPort || 3002)} />
          </div>
        </Card>

        {/* Software */}
        <Card heading={<span className="flex items-center gap-1.5"><Code size={10} /> Programa</span>}>
          <div className="space-y-0.5">
            <ConfigRow dark={dark} icon={<Sparkles size={12} />} label="Versión" value={configData.version || 'No disponible'} />
          </div>
        </Card>

        {/* Copy codes */}
        <Card heading="Códigos del dispositivo">
          <div className="space-y-2">
            <div className={`${dark ? 'bg-white/[0.03]' : 'bg-slate-100'} rounded-lg p-2.5 font-mono text-[10px] ${dark ? 'text-white/40' : 'text-slate-500'}`}>
              <p>ADB:</p>
              <code className="break-all">{configData.adb || '—'}</code>
            </div>
            <div className={`${dark ? 'bg-white/[0.03]' : 'bg-slate-100'} rounded-lg p-2.5 font-mono text-[10px] ${dark ? 'text-white/40' : 'text-slate-500'}`}>
              <p>Capturas:</p>
              <code className="break-all">{configData.capturesDir || '—'}</code>
            </div>
          </div>
        </Card>

        {/* Reset config */}
        <Card heading="Restablecer configuración">
          <div className="flex items-center justify-between gap-3">
            <p className={`text-[10px] ${t.textSub}`}>Recarga la configuración desde el dispositivo.</p>
            <button
              onClick={resetConfig}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${dark ? 'bg-white/[0.04] text-white/70 hover:bg-white/[0.08]' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              Recargar
            </button>
          </div>
        </Card>

        {/* Advanced sections */}
        <Card heading="Secciones avanzadas">
          <div className="space-y-1">
            <NavRow dark={dark} icon={<Settings size={12} />} label="Gestión de apps" onClick={() => setActiveNav('apps')} />
            <NavRow dark={dark} icon={<FolderOpen size={12} />} label="Transferencia de archivos" onClick={() => setActiveNav('archivos')} />
            <NavRow dark={dark} icon={<Wrench size={12} />} label="Herramientas avanzadas" onClick={() => setActiveNav('herramientas')} />
            <NavRow dark={dark} icon={<Camera size={12} />} label="Proyección de pantalla" onClick={() => setActiveNav('proyeccion')} />
          </div>
        </Card>
      </div>
    </ViewShell>
  );
}

// ── ConfigRow helper (internal to this view) ──────────────────────────

function ConfigRow({ icon, label, value, dark }: {
  icon: ReactNode;
  label: string;
  value: string;
  dark: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`flex items-center gap-2 py-1.5 border-b ${dark ? 'border-white/5' : 'border-slate-100'} last:border-0 transition-colors ${dark ? 'hover:bg-white/[0.02]' : 'hover:bg-slate-50'} -mx-1 px-1 rounded-lg`}>
      <div className={`shrink-0 ${dark ? 'text-white/35' : 'text-slate-400'}`}>{icon}</div>
      <div className="flex-1 min-w-0">
        <p className={`text-[10px] ${dark ? 'text-white/45' : 'text-slate-400'}`}>{label}</p>
        <p className={`text-[10px] font-mono truncate ${dark ? 'text-white/75' : 'text-slate-700'}`} title={value}>{value}</p>
      </div>
      <button
        onClick={handleCopy}
        className={`shrink-0 p-1 rounded transition-all duration-200 ${dark ? 'hover:bg-white/[0.08] text-white/20 hover:text-[#22c97d]' : 'hover:bg-slate-200 text-slate-400 hover:text-emerald-600'} ${copied ? (dark ? 'text-[#22c97d]' : 'text-emerald-600') : ''}`}
        title="Copiar"
      >
        {copied ? <Check size={10} /> : <Copy size={10} />}
      </button>
    </div>
  );
}

// ── NavRow helper (internal to this view) ─────────────────────────────

function NavRow({ dark, icon, label, onClick }: { dark: boolean; icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`w-full flex items-center justify-between gap-3 rounded-lg p-2.5 text-left transition-colors ${dark ? 'hover:bg-white/[0.04]' : 'hover:bg-slate-100'}`}>
      <span className="flex items-center gap-2.5">
        <span className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${dark ? 'bg-white/[0.04] text-[#22c97d]' : 'bg-slate-100 text-emerald-600'}`}>{icon}</span>
        <span className={`text-[10px] font-bold ${dark ? 'text-white/60' : 'text-slate-700'}`}>{label}</span>
      </span>
      <ChevronRight size={14} className={`${dark ? 'text-white/30' : 'text-slate-300'}`} />
    </button>
  );
}