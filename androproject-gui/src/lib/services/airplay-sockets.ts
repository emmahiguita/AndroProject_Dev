// ============================================================================
// ARCHIVO: airplay-sockets.ts
// QUÉ HACE: Detecta IPs de dispositivos iOS conectados en tiempo real a los
//           puertos TCP de AirPlay 2 (7001, 7100, 5001) en Windows.
// CÓMO FUNCIONA: Consulta `netstat -ano -p TCP`, filtra líneas `ESTABLISHED`
//           y extrae la IP remota válida (excluyendo loopback).
// POR QUÉ: Separar inspección de sockets de `airplay-engine.ts` (SRP, < 200L).
// ============================================================================

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export async function detectAirPlaySocketIps(): Promise<Set<string>> {
  const activeIps = new Set<string>();
  try {
    const { stdout } = await execAsync('netstat -ano -p TCP', { windowsHide: true, timeout: 2000 });
    for (const line of stdout.split(/\r?\n/)) {
      if (!line.includes('ESTABLISHED')) continue;
      if (!line.includes(':7001') && !line.includes(':7100') && !line.includes(':5001')) continue;
      const parts = line.trim().split(/\s+/);
      if (parts.length < 4 || !/:(7001|7100|5001)$/.test(parts[1])) continue;
      const remoteIp = parts[2].split(':')[0];
      if (remoteIp && remoteIp !== '127.0.0.1' && remoteIp !== '0.0.0.0' && !remoteIp.startsWith('[')) {
        activeIps.add(remoteIp);
      }
    }
  } catch {}
  return activeIps;
}
