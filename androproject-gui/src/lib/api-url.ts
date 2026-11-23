/** Dirige la API al servidor Rust cuando la interfaz se ejecuta dentro de Tauri. */
export function apiUrl(path: string): string {
  if (typeof window === 'undefined' || !path.startsWith('/api/')) return path;
  const { protocol, hostname } = window.location;
  return protocol === 'tauri:' || hostname === 'tauri.localhost'
    ? `http://127.0.0.1:3000${path}`
    : path;
}
