import { NextResponse } from 'next/server';
import { safeExec, getErrorMessage } from './_lib/helpers';
import { ActionContext } from './_lib/context';
import { ADB, cleanupOrphanedLocks } from '@/lib/config';

// ── WiFi Debug ─────────────────────────────────────────────────────

export async function enableWifi(ctx: ActionContext) {
  try {
    // Obtener IP del dispositivo
    const rIp = await safeExec(`${ctx.adbTarget} shell ip route`);
    if (!rIp.ok) throw new Error('Error ejecutando ip route');
    const ipLine = rIp.out.split('\n').find(
      (line: string) => (line.includes('wlan') || line.includes('eth')) && line.includes('src')
    );
    if (!ipLine) throw new Error('No se pudo encontrar la IP del celular en la interfaz inalámbrica.');
    const match = ipLine.match(/src\s+([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})/);
    if (!match) throw new Error('No se pudo descifrar la IP del celular.');
    const deviceIp = match[1];

    // Verificar si ya está conectado
    const { out: devicesOut } = await safeExec(`"${ADB}" devices`);
    if ((devicesOut || '').includes(`${deviceIp}:5555`)) {
      return NextResponse.json({ success: true, message: `Wi-Fi silencioso ya activo (${deviceIp}).`, ip: deviceIp });
    }

    // Verificar si TCP/IP ya está listo
    const rTcp = await safeExec(`${ctx.adbTarget} shell cat /proc/net/tcp`);
    const isTcpipReady = rTcp.ok && rTcp.out.includes(':15B3');

    if (!isTcpipReady) {
      await safeExec(`${ctx.adbTarget} tcpip 5555`);
      await new Promise(r => setTimeout(r, 2000));
    }
    await safeExec(`"${ADB}" connect ${deviceIp}:5555`);

    return NextResponse.json({ success: true, message: `Conexión Wi-Fi establecida en segundo plano (${deviceIp}).`, ip: deviceIp });
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
    Start-Sleep -Milliseconds 500
    foreach ($t in $tasks) {
        if ($t.AR.IsCompleted -and $t.TCP.Connected) {
            Write-Output $t.IP
            $t.TCP.Close()
            exit
        }
        $t.TCP.Close()
    }
  `;

  try {
    const encoded = Buffer.from(psScript, 'utf16le').toString('base64');
    const rScan = await safeExec(`powershell -ExecutionPolicy Bypass -NoProfile -EncodedCommand ${encoded}`, 10000);
    const ip = rScan.ok ? rScan.out.trim() : '';
    if (ip) {
      await safeExec(`"${ADB}" connect ${ip}:5555`);
      return NextResponse.json({ success: true, message: `Radar exitoso. Conectado a ${ip}` });
    }
    throw new Error('No se encontraron celulares con el puerto 5555 abierto.');
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
  let r = await safeExec(`${ctx.adbTarget} shell settings put global private_dns_mode ${mode}`);
  if (r.ok && mode === 'hostname' && hostname) {
    r = await safeExec(`${ctx.adbTarget} shell settings put global private_dns_specifier ${hostname}`);
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

// ── DNS Tunneling (dns2tcp) ────────────────────────────────────────

export async function dnsTunnelSetup(ctx: ActionContext, body: { domain: string; key: string }) {
  const { domain, key } = body;
  if (!domain || !key) return NextResponse.json({ success: false, error: 'Dominio y clave requeridos' }, { status: 400 });

  const r = await safeExec(
    `${ctx.adbTarget} shell "su -c 'apt update && apt install -y dns2tcp'" 2>/dev/null || pkg install -y dns2tcp 2>/dev/null || apt install -y dns2tcp`,
    30000
  );
  if (!r.ok) {
    return NextResponse.json({ success: false, error: `Instalación fallida: ${r.err}. Requiere Termux con Ubuntu.` });
  }

  const config = `listen = 127.0.0.1\nport = 2080\nuser = nobody\ndomain = ${domain}\nkey = ${key}\n`;
  const escapedConfig = config.replace(/'/g, "'\\''");
  const r2 = await safeExec(`${ctx.adbTarget} shell "echo '${escapedConfig}' > /data/local/tmp/dns2tcpd.conf"`);
  return NextResponse.json({ success: r2.ok, message: r2.ok ? 'dns2tcp instalado y configurado' : r2.err });
}

export async function dnsTunnelStart(ctx: ActionContext) {
  const r = await safeExec(
    `${ctx.adbTarget} shell "dns2tcpc -f /data/local/tmp/dns2tcpd.conf > /data/local/tmp/dns2tcp.log 2>&1 &"`
  );
  if (r.ok) {
    await safeExec(`${ctx.adbTarget} shell settings put global http_proxy 127.0.0.1:2080`);
  }
  return NextResponse.json({ success: r.ok, message: r.ok ? 'Túnel DNS iniciado (SOCKS5 en :2080)' : r.err });
}

export async function dnsTunnelStop(ctx: ActionContext) {
  const r1 = await safeExec(`${ctx.adbTarget} shell "pkill -f dns2tcpc"`);
  const r2 = await safeExec(`${ctx.adbTarget} shell settings put global http_proxy :0`);
  const ok = r1.ok || r2.ok;
  return NextResponse.json({ success: ok, message: ok ? 'Túnel DNS detenido' : r1.err });
}

export async function dnsTunnelStatus(ctx: ActionContext) {
  const r = await safeExec(`${ctx.adbTarget} shell "pgrep -f dns2tcpc && echo 'running' || echo 'stopped'"`);
  const running = (r.out || '').trim().includes('running');
  const proxy = await safeExec(`${ctx.adbTarget} shell settings get global http_proxy`);
  return NextResponse.json({
    success: true,
    running,
    proxy: (proxy.out || '').trim(),
    pid: (r.out || '').trim().split('\n')[0] || null,
  });
}
