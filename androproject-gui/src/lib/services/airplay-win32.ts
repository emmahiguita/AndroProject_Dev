// ============================================================================
// ARCHIVO: airplay-win32.ts
// QUÉ HACE: Helpers nativos de Windows para AirPlay 2 (resolución de binarios,
//           configuración INI, Bonjour mDNSResponder, foco y captura PNG).
// CÓMO FUNCIONA: Usa `tasklist`, `spawn` para `mDNSResponder.exe` y PowerShell
//           Win32 (`EnumWindows` / `PrintWindow`) para enfocar/capturar la
//           ventana Direct3D11 sin bloquear el event loop.
// POR QUÉ: Desacoplar Win32/GDI de `airplay-engine.ts` (SRP, < 200 líneas).
// ============================================================================

import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import path from 'path';
import fs from 'fs';

const execAsync = promisify(exec);

export function resolveAirPlayDir(): string {
  const candidates = [
    path.join(/*turbopackIgnore: true*/ process.cwd(), 'bin', 'airplay'),
    path.join(/*turbopackIgnore: true*/ process.cwd(), 'androproject-gui', 'bin', 'airplay'),
    'c:\\Users\\emman\\Desktop\\Proyectos\\AndroProject_Dev\\androproject-gui\\bin\\airplay',
  ];
  for (const dir of candidates) {
    if (fs.existsSync(path.join(dir, 'AirPlayServer.exe'))) return dir;
  }
  return candidates[0];
}

export function getLocalIpAndMac(): { ip: string; mac: string } {
  const ifaces = os.networkInterfaces();
  let fallback = { ip: '192.168.0.6', mac: 'c8:53:09:dd:df:de' };
  for (const name of Object.keys(ifaces)) {
    if (/tailscale|vpn|wsl/i.test(name)) continue;
    for (const net of ifaces[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        const mac = (net.mac || 'c8:53:09:dd:df:de').toLowerCase();
        if (net.address.startsWith('192.168.')) return { ip: net.address, mac };
        if (net.address.startsWith('10.') || net.address.startsWith('172.')) fallback = { ip: net.address, mac };
      }
    }
  }
  return fallback;
}

export function spawnAirPlayProcess(airplayDir: string) {
  const airplayExe = path.join(airplayDir, 'AirPlayServer.exe');
  if (!fs.existsSync(airplayExe)) return null;
  const libDir = path.join(airplayDir, 'lib');
  const gstDir = path.join(libDir, 'gstreamer-1.0');
  const daemonCjs = path.join(airplayDir, ['daemon', 'cjs'].join('.'));
  const env = { ...process.env, PATH: `${airplayDir};${libDir};${gstDir};${process.env.PATH || ''}`, GST_PLUGIN_PATH: gstDir, GST_PLUGIN_SYSTEM_PATH: gstDir, SDL_AUDIODRIVER: 'dummy' };
  const proc = fs.existsSync(daemonCjs)
    ? spawn('cmd.exe', ['/c', 'node', daemonCjs], { cwd: airplayDir, detached: true, stdio: 'ignore', windowsHide: false, shell: false, env })
    : spawn(airplayExe, [], { cwd: airplayDir, detached: true, stdio: 'ignore', windowsHide: false, shell: false, env });
  proc.unref();
  return proc;
}

export async function findRunningAirPlayPid(): Promise<number | null> {
  try {
    const { stdout } = await execAsync('tasklist /FI "IMAGENAME eq AirPlayServer.exe" /FO CSV /NH', { windowsHide: true, timeout: 2500 });
    const match = stdout.match(/"AirPlayServer\.exe","(\d+)"/i);
    return match?.[1] ? parseInt(match[1], 10) : null;
  } catch { return null; }
}

export function syncAirPlaySettingsIni(airplayDir: string, serverName: string, pinRequired: boolean, audioEnabled: boolean): void {
  const iniContent = [
    '[General]', `DeviceName=${serverName || 'AndroProject [PC]'}`,
    'QualityPreset=0', 'AutoFullscreenOnConnect=0', 'OverlayState=0', 'ShowOverlay=0', '',
    '[Security]', `RequirePin=${pinRequired ? 1 : 0}`, 'HidePin=0', '',
    '[Display]', 'MatchReceiverMonitor=0', 'CustomWidth=430', 'CustomHeight=920', '',
    '[ScreenCast]', 'Enabled=1', 'HideInterface=0', 'CropToVideo=1', '',
    '[Audio]', 'AutoAdjust=0', `LocalVolume=${audioEnabled ? 1 : 0}`, '',
  ].join('\r\n');
  try { fs.writeFileSync(path.join(airplayDir, 'airplay_settings.ini'), iniContent, 'utf-8'); } catch {}
}

export async function ensureBonjourDaemon(airplayDir: string): Promise<void> {
  try {
    const { stdout } = await execAsync('tasklist /FI "IMAGENAME eq mDNSResponder.exe" /FO CSV /NH', { windowsHide: true, timeout: 2000 });
    if (!stdout.toLowerCase().includes('mdnsresponder.exe')) {
      const mdnsExe = path.join(airplayDir, 'mDNSResponder.exe');
      if (fs.existsSync(mdnsExe)) spawn(mdnsExe, [], { cwd: airplayDir, detached: true, stdio: 'ignore', windowsHide: true }).unref();
    }
  } catch {}
}

export async function focusAirPlayWindow(): Promise<boolean> {
  const ps = `
Add-Type @"
using System; using System.Runtime.InteropServices; using System.Text;
public class AirWinFocus {
  public delegate bool EnumWindowsProc(IntPtr h, IntPtr p);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc f, IntPtr p);
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, StringBuilder s, int c);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int n);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
}
"@
[AirWinFocus]::EnumWindows({ param($h,$p)
  $sb = New-Object System.Text.StringBuilder 256
  [AirWinFocus]::GetWindowText($h,$sb,256) | Out-Null
  if ($sb.ToString() -eq 'AirPlay Receiver') { [AirWinFocus]::ShowWindow($h,9)|Out-Null; [AirWinFocus]::SetForegroundWindow($h)|Out-Null }
  return $true
}, [IntPtr]::Zero) | Out-Null`;
  try {
    const enc = Buffer.from(ps, 'utf16le').toString('base64');
    await execAsync(`powershell.exe -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${enc}`, { windowsHide: true, timeout: 4000 });
    return true;
  } catch { return false; }
}

export async function captureAirPlayWindowPng(): Promise<Buffer | null> {
  const ps = `
Add-Type -AssemblyName System.Drawing
Add-Type @"
using System; using System.Runtime.InteropServices; using System.Text;
public class AirWinCapture {
  public delegate bool EnumWindowsProc(IntPtr h, IntPtr p);
  [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc f, IntPtr p);
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, StringBuilder s, int c);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h, IntPtr hdc, uint fl);
  public struct RECT { public int Left, Top, Right, Bottom; }
}
"@
[AirWinCapture]::SetProcessDPIAware() | Out-Null
$clean = [IntPtr]::Zero; $main = [IntPtr]::Zero
[AirWinCapture]::EnumWindows({ param($h,$p)
  $sb = New-Object System.Text.StringBuilder 256
  [AirWinCapture]::GetWindowText($h,$sb,256) | Out-Null; $t = $sb.ToString()
  if ($t -eq 'AirPlay Receiver - Clean Feed' -and [AirWinCapture]::IsWindowVisible($h)) {
    $r = New-Object AirWinCapture+RECT; [AirWinCapture]::GetWindowRect($h,[ref]$r)|Out-Null
    if (($r.Right - $r.Left) -gt 50) { $script:clean = $h }
  } elseif ($t -eq 'AirPlay Receiver') { $script:main = $h }
  return $true
}, [IntPtr]::Zero) | Out-Null
$target = if ($clean -ne [IntPtr]::Zero) { $clean } else { $main }
if ($target -ne [IntPtr]::Zero) {
  $r = New-Object AirWinCapture+RECT; [AirWinCapture]::GetWindowRect($target,[ref]$r)|Out-Null
  $w = $r.Right - $r.Left; $h = $r.Bottom - $r.Top
  if ($w -gt 50 -and $h -gt 50) {
    $bmp = New-Object System.Drawing.Bitmap($w,$h); $g = [System.Drawing.Graphics]::FromImage($bmp); $hdc = $g.GetHdc()
    [AirWinCapture]::PrintWindow($target,$hdc,2)|Out-Null; $g.ReleaseHdc($hdc); $g.Dispose()
    $ms = New-Object System.IO.MemoryStream; $bmp.Save($ms,[System.Drawing.Imaging.ImageFormat]::Png); $bmp.Dispose()
    [Convert]::ToBase64String($ms.ToArray()); $ms.Dispose()
  }
}`;
  const enc = Buffer.from(ps, 'utf16le').toString('base64');
  const { stdout } = await execAsync(`powershell.exe -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${enc}`, {
    windowsHide: true, timeout: 3000, maxBuffer: 10 * 1024 * 1024,
  });
  const b64 = stdout.trim();
  if (b64.length > 200) {
    const buf = Buffer.from(b64, 'base64');
    if (buf[0] === 0x89 && buf[1] === 0x50) return buf;
  }
  return null;
}
