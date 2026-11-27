import type { DiscoveryState, InjectorMode } from './CliEngineSelector';

// Cada botón rellena la consulta editable del motor correspondiente.
export const PRESETS: Record<InjectorMode, { label: string; value: string }[]> = {
  claude: [
    { label: 'Diagnosticar estado', value: 'Analiza el estado general del teléfono conectado y sugiere 3 optimizaciones.' },
    { label: 'Auditoría OWASP MASVS', value: 'Genera una lista de verificación defensiva OWASP MASVS para auditar la postura de seguridad de este dispositivo Android (SELinux, parche, Verified Boot, permisos sensibles y DNS privado).' },
    { label: 'Seguridad y Permisos', value: '¿Cómo verificar y endurecer aplicaciones con permisos excesivos (Overlay, Accesibilidad, Notificaciones) en segundo plano?' },
  ],
  ollama: [
    { label: 'Auditoría defensiva Android', value: 'Indica cómo evaluar el nivel de parche, estado SELinux, bootloader, DNS privado y apps con Overlay/Accesibilidad para endurecer este Android (enfoque 100% defensivo).' },
    { label: 'Hardening de privacidad', value: 'Recomienda 5 ajustes defensivos de privacidad y anti-adware para este dispositivo Android sin afectar estabilidad.' },
    { label: 'Análisis de rendimiento', value: 'Analiza el hardware del dispositivo y recomienda balance de memoria y batería.' },
  ],
  adb: [
    { label: 'Modelo', value: 'getprop ro.product.model' },
    { label: 'Batería', value: 'dumpsys battery' },
    { label: 'RAM', value: 'cat /proc/meminfo' },
    { label: 'Apps usuario', value: 'pm list packages -3' },
  ],
  cli: [
    { label: 'Claude Version', value: 'claude --version' },
    { label: 'ADB Devices', value: 'adb devices -l' },
    { label: 'Ollama List', value: 'ollama list' },
  ],
};

// Habilita la ejecución únicamente cuando el servidor confirma el motor seleccionado.
export function engineAvailable(mode: InjectorMode, discovery: DiscoveryState): boolean {
  return mode === 'ollama' ? discovery.ollamaOnline : discovery.clis[mode] === true;
}
