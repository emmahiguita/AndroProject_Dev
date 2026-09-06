'use client';

import React from 'react';
import {
  LayoutDashboard, Smartphone, FolderOpen, Zap, ShieldCheck,
  Terminal, Wrench, Settings, ChevronLeft, ChevronRight, Sparkles,
  MonitorPlay,
} from 'lucide-react';
import { useAppTheme } from '../ThemeProvider';
import { NavSection } from '../../features/types';

interface SidebarProps {
  activeNav: NavSection;
  onSelectNav: (section: NavSection) => void;
  collapsed?: boolean;
  onToggle?: () => void;
}

type NavItemDef = { id: NavSection; label: string; icon: React.ReactNode; badge?: boolean };

const groups: { label: string; items: NavItemDef[] }[] = [
  {
    label: 'GENERAL',
    items: [
      { id: 'dashboard', label: 'Panel', icon: <LayoutDashboard size={16} /> },
      { id: 'projection', label: 'Proyección', icon: <MonitorPlay size={16} /> },
      { id: 'apps',      label: 'Aplicaciones', icon: <Smartphone size={16} /> },
      { id: 'archivos',  label: 'Archivos', icon: <FolderOpen size={16} /> },
    ],
  },
  {
    label: 'DISPOSITIVO',
    items: [
      { id: 'optimizer', label: 'Optimizador', icon: <Zap size={16} /> },
      { id: 'curar',     label: 'Seguridad', icon: <ShieldCheck size={16} /> },
    ],
  },
  {
    label: 'HERRAMIENTAS',
    items: [
      { id: 'tools',     label: 'Herramientas', icon: <Wrench size={16} /> },
      { id: 'flasher',   label: 'Flasheador', icon: <Zap size={16} /> },
    ],
  },

  {
    label: 'SISTEMA',
    items: [
      { id: 'config',    label: 'Ajustes', icon: <Settings size={16} />, badge: true },
    ],
  },
];

export const Sidebar: React.FC<SidebarProps> = ({ activeNav, onSelectNav, collapsed, onToggle }) => {
  const { isDark } = useAppTheme();
  const w = collapsed ? 'w-14' : 'w-56';

  return (
    <aside className={`${w} h-full shrink-0 flex flex-col justify-between border-r z-30 transition-all duration-200 overflow-hidden ${
      isDark ? 'bg-zinc-950 border-zinc-800/80' : 'bg-white border-slate-200'
    }`}>
      {/* Top section with scrollable nav */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar py-3">
        {/* Logo row */}
        <div className={`flex items-center px-3 mb-5 ${collapsed ? 'justify-center' : 'gap-2.5'}`}>
          <div className="w-8 h-8 rounded-lg overflow-hidden border border-zinc-800 shrink-0 bg-zinc-900 flex items-center justify-center ring-1 ring-white/[0.04] hover:scale-105 transition-transform">
            <img src="/logo.png" alt="Dexterand Logo" className="w-full h-full object-cover" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <h1 className={`text-xs font-semibold tracking-tight ${isDark ? 'text-zinc-100' : 'text-slate-800'}`}>Dexterand</h1>
              <p className="text-[10px] text-zinc-400 font-medium tracking-wider uppercase">Studio</p>
            </div>
          )}
        </div>

        {/* Nav groups */}
        <nav className="space-y-3 px-2">
          {groups.map((group) => (
            <div key={group.label}>
              {!collapsed && (
                <p className={`text-[9px] font-semibold uppercase tracking-[0.12em] px-3 mb-1.5 ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>
                  {group.label}
                </p>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = activeNav === item.id;
                  return (
                    <button
                      key={`${group.label}-${item.label}`}
                      onClick={() => onSelectNav(item.id)}
                      title={collapsed ? item.label : undefined}
                      className={`w-full flex items-center rounded-lg font-medium transition-colors ${
                        collapsed ? 'justify-center px-0 py-2' : 'gap-2.5 px-3 py-1.5'
                      } ${
                        active
                          ? isDark
                            ? 'bg-zinc-800/90 text-zinc-100 border border-zinc-700/60 shadow-sm'
                            : 'bg-slate-100 text-slate-900'
                          : isDark
                            ? 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60 border border-transparent'
                            : 'text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                      }`}
                    >
                      <span className={`shrink-0 ${active ? (isDark ? 'text-zinc-100' : 'text-slate-900') : 'text-zinc-400'}`}>
                        {item.icon}
                      </span>
                      {!collapsed && (
                        <span className="truncate text-xs">{item.label}</span>
                      )}
                      {!collapsed && item.badge && (
                        <span className="ml-auto w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      {/* Bottom section */}
      <div className="shrink-0 px-2 pb-3 pt-2 space-y-2 border-t border-zinc-800/80">
        {/* Collapse button */}
        {onToggle && (
          <button
            onClick={onToggle}
            className={`w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-[10px] font-medium transition-colors ${
              isDark ? 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/60' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
            }`}
          >
            {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
            {!collapsed && <span>Colapsar</span>}
          </button>
        )}

        {/* Pro card */}
        {!collapsed && (
          <div className={`rounded-xl border p-3 ${
            isDark ? 'bg-zinc-900/40 border-zinc-800/80' : 'bg-slate-50 border-slate-200'
          }`}>
            <div className="flex items-center gap-1.5 mb-1">
              <Sparkles size={12} className={isDark ? 'text-zinc-400' : 'text-slate-600'} />
              <span className={`text-[11px] font-semibold ${isDark ? 'text-zinc-200' : 'text-slate-700'}`}>Dexterand Studio</span>
            </div>
            <p className={`text-[10px] leading-relaxed mb-2.5 ${isDark ? 'text-zinc-500' : 'text-slate-400'}`}>
              Control integral y diagnóstico forense móvil.
            </p>
            <button
              onClick={() => onSelectNav('config')}
              className="w-full py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700/60 text-xs font-medium transition-colors cursor-pointer"
            >
              Ajustes del sistema
            </button>
          </div>
        )}
      </div>
    </aside>
  );
};
