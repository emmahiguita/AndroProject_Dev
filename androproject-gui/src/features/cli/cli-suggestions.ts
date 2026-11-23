import type { DiscoveryState, InjectorMode } from './CliEngineSelector';

// Cada botón rellena la consulta editable del motor correspondiente.
export const PRESETS: Record<InjectorMode, { label: string; value: string }[]> = {
  claude: [
    { label: 'Diagnosticar estado', value: 'Analiza el estado general del teléfono conectado y sugiere 3 optimizaciones.' },
    { label: 'Auditar batería', value: '¿Qué comandos ADB debo ejecutar para revisar el consumo y temperatura de batería?' },
    { label: 'Seguridad y Permisos', value: '¿Cómo verificar si hay aplicaciones con permisos excesivos en segundo plano?' },
  ],
  ollama: [
    { label: 'Análisis de rendimiento', value: 'Analiza el hardware del dispositivo y recomienda balance de memoria.' },
    { label: 'Comandos clave', value: 'Lista 5 comandos ADB esenciales para depuración en producción.' },
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
