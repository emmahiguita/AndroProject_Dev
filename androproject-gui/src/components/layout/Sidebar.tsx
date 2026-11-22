// ============================================================================
// ARCHIVO: Sidebar.tsx
// QUÉ HACE: Barra lateral de navegación principal de ANDRO-IOS Studio con
//           grupos semánticos, estado activo y modo colapsable.
// CÓMO FUNCIONA: Lee el tema desde `useAppTheme()` y delega el cambio de
//           sección a `onSelectNav` manteniendo accesible cada ruta.
// POR QUÉ: Separar la navegación del contenedor `AppShell` (SRP, < 200L).
// ============================================================================
'use client';

import React from 'react';
import {
  LayoutDashboard, Smartphone, FolderOpen, Zap, ShieldCheck,
  Terminal, Wrench, Settings, ChevronLeft, ChevronRight,
  MonitorPlay,
} from 'lucide-react';
import { NavSection } from '../../features/types';

interface SidebarProps {
  activeNav: NavSection;
  onSelectNav: (section: NavSection) => void;
  collapsed?: boolean;
  onToggle?: () => void;
}

type NavItemDef = { id: NavSection; label: string; icon: React.ReactNode };

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
      { id: 'cli',       label: 'CLI / IA', icon: <Terminal size={16} /> },
      { id: 'tools',     label: 'Herramientas', icon: <Wrench size={16} /> },
      { id: 'flasher',   label: 'Flasheador', icon: <Zap size={16} /> },
    ],
  },

  {
    label: 'SISTEMA',
    items: [
      { id: 'config',    label: 'Ajustes', icon: <Settings size={16} /> },
    ],
  },
];

export const Sidebar: React.FC<SidebarProps> = ({ activeNav, onSelectNav, collapsed, onToggle }) => {
  const w = collapsed ? 'w-16' : 'w-56';

  return (
    <aside id="studio-sidebar" className={`${w} z-30 flex h-full shrink-0 flex-col overflow-hidden border-r border-border bg-surface-chrome`}>
      {/* Top section with scrollable nav */}
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar py-4">
        {/* Logo row */}
        <div className={`flex items-center px-3 mb-5 ${collapsed ? 'justify-center' : 'gap-3'}`}>
          <div className="size-10 rounded-lg overflow-hidden border border-border shrink-0 bg-zinc-900">
            <img src="/logo.png" alt={collapsed ? 'ANDRO-IOS' : ''} className="w-full h-full object-cover" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-sm font-bold text-text-primary">ANDRO-IOS</p>
              <p className="text-2xs font-medium text-text-secondary">Studio</p>
            </div>
          )}
        </div>

        {/* Nav groups */}
        <nav aria-label="Secciones del estudio" className="space-y-4 px-2.5">
          {groups.map((group) => (
            <div key={group.label}>
              {!collapsed && (
                <p className="mb-1 px-2.5 text-2xs font-semibold tracking-wide text-text-tertiary">
                  {group.label}
                </p>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = activeNav === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onSelectNav(item.id)}
                      aria-current={active ? 'page' : undefined}
                      aria-label={collapsed ? item.label : undefined}
                      title={collapsed ? item.label : undefined}
                      className={`flex min-h-10 w-full items-center rounded-md border text-left text-sm transition-colors ${
                        collapsed ? 'justify-center' : 'gap-2.5 px-2.5'
                      } ${
                        active
                          ? 'border-border-selected bg-surface-selected font-semibold text-text-selected'
                          : 'border-transparent font-medium text-text-secondary hover:bg-surface-overlay hover:text-text-primary'
                      }`}
                    >
                      <span aria-hidden="true" className="shrink-0">{item.icon}</span>
                      {!collapsed && <span>{item.label}</span>}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      {/* Bottom section */}
      {onToggle && (
        <div className="shrink-0 border-t border-border p-2.5">
          <button
            type="button"
            onClick={onToggle}
            aria-label={collapsed ? 'Expandir menú lateral' : 'Colapsar menú lateral'}
            title={collapsed ? 'Expandir menú lateral' : 'Colapsar menú lateral'}
            className="flex min-h-9 w-full items-center justify-center gap-2 rounded-md text-xs font-medium text-text-secondary transition-colors hover:bg-surface-overlay hover:text-text-primary"
          >
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
            {!collapsed && <span>Colapsar</span>}
          </button>
        </div>
      )}
    </aside>
  );
};
