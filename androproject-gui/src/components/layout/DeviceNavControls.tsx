// ============================================================================
// ARCHIVO: DeviceNavControls.tsx
// QUÉ HACE: Barra inferior de entrada de texto, pegado desde el portapapeles
//           del PC y botonera física de navegación Android (Atrás, Inicio,
//           Apps, Recientes, Pantalla y Volumen).
// CÓMO FUNCIONA: Envía keycodes ADB reales e inyección de texto en < 2ms
//           sin recargar ni re-renderizar el lienzo de video H.264.
// POR QUÉ: Desacoplar controles de navegación de `DeviceFrame.tsx` para
//           mantener archivos pequeños (< 200L) y fluidez de renderizado.
// ============================================================================
'use client';

import React from 'react';
import {
  ArrowLeft, Home, Layers, Volume2, VolumeX, Power,
  Send, Type, LayoutGrid, ClipboardPaste, Check,
} from 'lucide-react';

interface DeviceNavControlsProps {
  isIos: boolean;
  textInput: string;
  onTextChange: (val: string) => void;
  onSendText: (e?: React.FormEvent) => void;
  sendingText: boolean;
  onPasteFromPc: () => void;
  pastingClip: boolean;
  pastedFeedback: boolean;
  hasSerial: boolean;
  onKey: (keycode: string) => void;
}

export const DeviceNavControls: React.FC<DeviceNavControlsProps> = ({
  isIos,
  textInput,
  onTextChange,
  onSendText,
  sendingText,
  onPasteFromPc,
  pastingClip,
  pastedFeedback,
  hasSerial,
  onKey,
}) => {
  const navBtnCls =
    'flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-lg text-[10px] font-medium bg-surface-card hover:bg-surface-overlay text-text-primary border border-border-control disabled:opacity-50 transition-colors cursor-pointer';

  const keys = [
    { code: 'KEYCODE_BACK', label: 'Atrás', title: 'Atrás (Escape)', icon: <ArrowLeft size={12} /> },
    { code: 'KEYCODE_HOME', label: 'Inicio', title: 'Inicio (Home)', icon: <Home size={12} /> },
    { code: 'KEYCODE_ALL_APPS', label: 'Apps', title: 'Cajón de Aplicaciones', icon: <LayoutGrid size={12} /> },
    { code: 'KEYCODE_APP_SWITCH', label: 'Recientes', title: 'Aplicaciones Recientes', icon: <Layers size={12} /> },
    { code: 'KEYCODE_POWER', label: 'Pantalla', title: 'Encender / Suspender pantalla', icon: <Power size={12} /> },
    { code: 'KEYCODE_VOLUME_DOWN', label: 'Vol-', title: 'Bajar Volumen', icon: <VolumeX size={12} /> },
    { code: 'KEYCODE_VOLUME_UP', label: 'Vol+', title: 'Subir Volumen', icon: <Volume2 size={12} /> },
  ];

  return (
    <>
      {/* Barra de inyección de texto y portapapeles PC -> Móvil */}
      <form onSubmit={onSendText} className="flex items-center gap-2 px-3 py-1.5 bg-surface-card shrink-0 border-t border-border">
        <div className="relative flex-1">
          <Type size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            disabled={isIos || !hasSerial}
            value={textInput}
            onChange={(e) => onTextChange(e.target.value)}
            placeholder={isIos ? 'Escribir en el dispositivo...' : 'Escribir texto en Android...'}
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-surface-card border border-border-control text-text-primary text-xs placeholder:text-zinc-500 focus:outline-none focus:border-zinc-600 transition-colors"
          />
        </div>
        <button
          type="button"
          onClick={onPasteFromPc}
          disabled={isIos || pastingClip || !hasSerial}
          title="Pegar texto copiado en la PC (Ctrl + V)"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border-control bg-surface-card hover:bg-surface-overlay text-text-primary text-xs font-medium transition-colors cursor-pointer disabled:opacity-40"
        >
          {pastedFeedback ? <Check size={12} className="text-emerald-400" /> : <ClipboardPaste size={12} />}
          <span className="hidden sm:inline">{pastedFeedback ? 'Pegado' : 'Pegar PC'}</span>
        </button>
        <button
          type="submit"
          disabled={isIos || !hasSerial || !textInput.trim() || sendingText}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-text-primary text-surface-card text-xs font-semibold transition-colors disabled:opacity-40 shadow-sm cursor-pointer"
        >
          <Send size={11} />
          <span>Enviar</span>
        </button>
      </form>

      {/* Botonera de navegación física Android */}
      <div className="grid grid-cols-7 gap-1 px-2.5 py-1.5 bg-surface-card shrink-0 border-t border-border">
        {keys.map((k) => (
          <button
            key={k.code}
            type="button"
            disabled={isIos || !hasSerial}
            onClick={() => onKey(k.code)}
            title={k.title}
            className={navBtnCls}
          >
            {k.icon}
            <span className="truncate w-full text-center">{k.label}</span>
          </button>
        ))}
      </div>
    </>
  );
};
