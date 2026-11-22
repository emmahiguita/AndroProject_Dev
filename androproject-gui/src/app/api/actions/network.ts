import { NextResponse } from 'next/server';
import { safeExec, getErrorMessage } from './_lib/helpers';
import { ActionContext } from './_lib/context';
import { ADB, cleanupOrphanedLocks } from '@/lib/config';

// ── WiFi Debug ─────────────────────────────────────────────────────

export async function enableWifi(ctx: ActionContext) {
  try {
    let deviceIp = '';

    // 1. Intentar ip route
    const rIp = await safeExec(`${ctx.adbTarget} shell ip route`);
    if (rIp.ok) {
      const ipLine = rIp.out.split('\n').find(
        (line: string) => (line.includes('wlan') || line.includes('eth')) && line.includes('src')
      );
      if (ipLine) {
        const match = ipLine.match(/src\s+([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})/);
        if (match) deviceIp = match[1];
      }
    }

    // 2. Fallback: ip addr show wlan0
    if (!deviceIp) {
      const rAddr = await safeExec(`${ctx.adbTarget} shell ip -f inet addr show wlan0`);
      if (rAddr.ok) {
        const match = rAddr.out.match(/inet\s+([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})/);
        if (match) deviceIp = match[1];
      }
    }

    // 3. Fallback: getprop dhcp.wlan0.ipaddress
    if (!deviceIp) {
      const rProp = await safeExec(`${ctx.adbTarget} shell getprop dhcp.wlan0.ipaddress`);
      if (rProp.ok && rProp.out.trim()) {
        const propIp = rProp.out.trim();
        if (/^[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}$/.test(propIp)) {
          deviceIp = propIp;
        }
      }
    }

    if (!deviceIp) {
      throw new Error('No se pudo encontrar la dirección IP de la interfaz Wi-Fi (wlan0) en el dispositivo.');
    }

    // Activar puerto TCP/IP 5555
    await safeExec(`${ctx.adbTarget} tcpip 5555`);
    await new Promise((r) => setTimeout(r, 600));

    // Conectar vía ADB sobre Wi-Fi
    const connRes = await safeExec(`"${ADB}" connect ${deviceIp}:5555`);
    const success = connRes.ok && (connRes.out.includes('connected') || connRes.out.includes('already'));

    return NextResponse.json({
      success: true,
      message: `Conexión Wi-Fi auto-establecida (${deviceIp}:5555).`,
      ip: deviceIp,
      target: `${deviceIp}:5555`,
      connected: success,
    });
  } catch (err: unknown) {
    return NextResponse.json({ success: false, error: getErrorMessage(err) });
  }
}

// ── Radar ──────────────────────────────────────────────────────────

export async function radar() {
  await cleanupOrphanedLocks().catch(() => {});

  const psScript = `
    $localIp = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -match 'Wi-Fi|Ethernet' -and $_.IPAddress -notmatch '^169\\.' } | Select-Object -First 1).IPAddress
    if (-not $localIp) { exit }
    $base = $localIp.Substring(0, $localIp.LastIndexOf('.'))
    $ips = 1..254 | ForEach-Object { "$base.$_" }
    $tasks = foreach ($ip in $ips) {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $ar = $tcp.BeginConnect($ip, 5555, $null, $null)
        [PSCustomObject]@{ IP = $ip; AR = $ar; TCP = $tcp }
    }
    Start-Sleep -Milliseconds 600
    $found = @()
    foreach ($t in $tasks) {
        if ($t.AR.IsCompleted -and $t.TCP.Connected) {
            $found += $t.IP
        }
        $t.TCP.Close()
    }
    $found | ForEach-Object { Write-Output $_ }
  `;

  try {
    const encoded = Buffer.from(psScript, 'utf16le').toString('base64');
    const rScan = await safeExec(`powershell -ExecutionPolicy Bypass -NoProfile -WindowStyle Hidden -EncodedCommand ${encoded}`, 10000);
    const ips = rScan.ok ? rScan.out.trim().split(/\r?\n/).map(s => s.trim()).filter(Boolean) : [];
    if (ips.length > 0) {
      // Limpiar conexiones stale antes de reconectar para no acumular "offline"
      await safeExec(`"${ADB}" disconnect`);
      await Promise.all(ips.map(ip => safeExec(`"${ADB}" connect ${ip}:5555`)));
      return NextResponse.json({ success: true, message: `Radar exitoso. Conectado a: ${ips.join(', ')}`, ips });
    }
    return NextResponse.json({ success: false, error: 'No se encontraron celulares con el puerto 5555 abierto.' });
  } catch (err: unknown) {
    return NextResponse.json({ success: false, error: getErrorMessage(err) });
  }
}

// ── WiFi Settings ──────────────────────────────────────────────────

export async function setWifiScanInterval(ctx: ActionContext, body: { interval: number }) {
  const { interval } = body;
  const r1 = await safeExec(`${ctx.adbTarget} shell settings put global wifi_scan_throttle_enabled ${interval === 0 ? '0' : '1'}`);
  if (interval > 0 && r1.ok) {
    await safeExec(`${ctx.adbTarget} shell settings put global wifi_scan_interval_ms ${interval}`);
  }
  return NextResponse.json({ success: r1.ok, message: r1.ok ? `Scan: ${interval}ms` : r1.err });
}

export async function setWifiPowerSave(ctx: ActionContext, body: { enabled: boolean }) {
  const r = await safeExec(`${ctx.adbTarget} shell settings put global wifi_power_save ${body.enabled ? '1' : '0'}`);
  return NextResponse.json({ success: r.ok, message: r.ok ? `WiFi PS: ${body.enabled ? 'ON' : 'OFF'}` : r.err });
}

// ── Private DNS ────────────────────────────────────────────────────

export async function setPrivateDns(ctx: ActionContext, body: { mode: string; hostname?: string }) {
  const { mode, hostname } = body;
  if (!['off', 'automatic', 'hostname'].includes(mode)) {
    return NextResponse.json({ success: false, error: 'Modo DNS inválido' }, { status: 400 });
  }
  if (mode === 'hostname' && hostname && !/^[a-zA-Z0-9.-]{1,253}$/.test(hostname.trim())) {
    return NextResponse.json({ success: false, error: 'Hostname DNS inválido' }, { status: 400 });
  }
  let r = await safeExec(`${ctx.adbTarget} shell settings put global private_dns_mode ${mode}`);
  if (r.ok && mode === 'hostname' && hostname) {
    r = await safeExec(`${ctx.adbTarget} shell settings put global private_dns_specifier ${hostname.trim()}`);
  }
  return NextResponse.json({ success: r.ok, message: r.ok ? `DNS: ${mode}` : r.err });
}

// ── AdGuard DNS Profiles ──────────────────────────────────────────

export async function setAdguardDns(ctx: ActionContext, body: { profile: string }) {
  const { profile } = body;
  const ADGUARD_HOSTS: Record<string, string> = {
    default: 'dns.adguard-dns.com',
    family: 'family.adguard-dns.com',
    nonfiltering: 'unfiltered.adguard-dns.com',
  };

  if (profile === 'off') {
    const r = await safeExec(`${ctx.adbTarget} shell settings put global private_dns_mode off`);
    return NextResponse.json({ success: r.ok, message: r.ok ? 'AdGuard DNS: OFF' : r.err });
  }

  const hostname = ADGUARD_HOSTS[profile];
  if (!hostname) return NextResponse.json({ success: false, error: 'Perfil AdGuard no válido' }, { status: 400 });

  let r = await safeExec(`${ctx.adbTarget} shell settings put global private_dns_mode hostname`);
  if (r.ok) r = await safeExec(`${ctx.adbTarget} shell settings put global private_dns_specifier ${hostname}`);
  return NextResponse.json({ success: r.ok, message: r.ok ? `AdGuard DNS: ${profile}` : r.err });
}

// ── DNS Tunneling (delegado a _lib/dns-tunnel.ts por SRP < 200L) ───
export { dnsTunnelSetup, dnsTunnelStart, dnsTunnelStop, dnsTunnelStatus } from './_lib/dns-tunnel';

// ── Universal Rescue Hardening (anti-suspensión para cualquier móvil) ──
export async function applyRescueHardening(ctx: ActionContext, body: { enabled?: boolean }) {
  if (!ctx.targetSerial) {
    return NextResponse.json({ success: false, error: 'Se requiere dispositivo conectado' }, { status: 400 });
  }
  const enable = body.enabled !== false;
  const cmds = enable
    ? [
        'settings put global adb_wifi_enabled 1',
        'settings put global wifi_sleep_policy 2',
        'settings put global stay_on_while_plugged_in 7',
        'settings put system screen_off_timeout 2147483647',
        'svc power stayon true',
      ]
    : [
        'settings put global wifi_sleep_policy 0',
        'settings put global stay_on_while_plugged_in 0',
        'settings put system screen_off_timeout 60000',
        'svc power stayon false',
      ];
  const results = await Promise.all(cmds.map((c) => safeExec(`${ctx.adbTarget} shell ${c}`, 3000)));
  const ok = results.some((r) => r.ok);
  return NextResponse.json({
    success: ok,
    message: enable ? 'Hardening anti-suspensión aplicado' : 'Políticas de energía restauradas',
  });
}
