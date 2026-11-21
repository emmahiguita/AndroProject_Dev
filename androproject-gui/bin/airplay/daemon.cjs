const { spawn, exec } = require('child_process');
const path = require('path');
const os = require('os');
const fs = require('fs');

const airplayDir = __dirname;
const airplayExe = path.join(airplayDir, 'AirPlayServer.exe');
const bakDll = path.join(airplayDir, 'airplay2dll.dll.bak');
const targetDll = path.join(airplayDir, 'airplay2dll.dll');
const iniPath = path.join(airplayDir, 'airplay_settings.ini');
const libDir = path.join(airplayDir, 'lib');
const gstDir = path.join(libDir, 'gstreamer-1.0');
const createMdns = require(path.join(airplayDir, '..', '..', 'node_modules', 'multicast-dns'));

/**
 * Reads airplay_settings.ini to check if optional PC audio is enabled (LocalVolume > 0)
 * Default is LocalVolume=0 (Audio stays on Mobile iPhone speaker).
 */
function isPcAudioEnabled() {
  try {
    if (fs.existsSync(iniPath)) {
      const txt = fs.readFileSync(iniPath, 'utf-8');
      const m = txt.match(/LocalVolume\s*=\s*([0-9.]+)/i);
      if (m && parseFloat(m[1]) > 0) {
        return true;
      }
    }
  } catch (e) {}
  return false;
}

/**
 * Configures airplay2dll.dll from airplay2dll.dll.bak:
 * - Always keeps RTSP SETUP 3 (offset 81052) 100% intact so playing music NEVER crashes or closes AirPlayServer.exe!
 * - When pcAudio=false (default: Audio on Mobile): clears SupportsAudio bit (0x200 -> 0x5A7FFCE6) and sets audioOutputFormats=0 in /info bplist00 so iOS keeps sound on the iPhone speaker.
 * - When pcAudio=true (optional: Audio on PC): restores full SupportsAudio (0x5A7FFEE6) and audioOutputFormats so sound plays on the PC.
 * - Optimizes TCP socket KeepAlive: increases keepalivetime from 5s to 30s and interval to 3s to prevent premature socket closure.
 */
function applyAudioModeToDll(pcAudio) {
  try {
    if (!fs.existsSync(bakDll)) return;
    const dll = Buffer.from(fs.readFileSync(bakDll));

    if (!pcAudio) {
      // 1. Zero audioOutputFormats in /info bplist00 (12 01 ff ff fc -> 12 00 00 00 00)
      const fmtIdx = dll.indexOf(Buffer.from([0x12, 0x01, 0xff, 0xff, 0xfc]));
      if (fmtIdx !== -1) {
        dll[fmtIdx + 1] = 0x00;
        dll[fmtIdx + 2] = 0x00;
        dll[fmtIdx + 3] = 0x00;
        dll[fmtIdx + 4] = 0x00;
      }
      // 2. Clear bit 9 (0x200 SupportsAudio) in /info bplist00 Big-Endian features (5A 7F FE E6 -> 5A 7F FC E6)
      const beIdx = dll.indexOf(Buffer.from([0x5a, 0x7f, 0xfe, 0xe6]));
      if (beIdx !== -1) {
        dll[beIdx + 2] = 0xfc;
      }
      // 3. Clear bit 9 (0x200 SupportsAudio) in Little-Endian feature constants (E6 FE 7F 5A -> E6 FC 7F 5A)
      const lePat = Buffer.from([0xe6, 0xfe, 0x7f, 0x5a]);
      let p = 0;
      while ((p = dll.indexOf(lePat, p)) !== -1) {
        dll[p + 1] = 0xfc;
        p += 4;
      }
      console.log('[AirPlay Daemon] Modo Audio: CELULAR (SupportsAudio=0 en /info, SETUP 3 intacto anti-cierre).');
    } else {
      console.log('[AirPlay Daemon] Modo Audio: PC OPCIONAL ACTIVADO (SupportsAudio=1, LocalVolume=1).');
    }

    // 4. Optimize TCP socket Keepalive on mirror receiver thread (offset ~0x1ca05)
    // Changes keepalivetime from 5000ms (0x1388) to 30000ms (0x7530) and interval from 1000ms (0x03e8) to 3000ms (0x0bb8)
    const kaPat = Buffer.from([0xc7, 0x45, 0xbc, 0x88, 0x13, 0x00, 0x00, 0xc7, 0x45, 0xc0, 0xe8, 0x03, 0x00, 0x00]);
    const kaIdx = dll.indexOf(kaPat);
    if (kaIdx !== -1) {
      dll[kaIdx + 3] = 0x30;
      dll[kaIdx + 4] = 0x75;
      dll[kaIdx + 10] = 0xb8;
      dll[kaIdx + 11] = 0x0b;
      console.log('[AirPlay Daemon] Socket TCP Keepalive optimizado (30s timeout, 3s intervalo anti-desconexión).');
    }

    fs.writeFileSync(targetDll, dll);
  } catch (e) {
    console.warn('[AirPlay Daemon] No se pudo actualizar airplay2dll.dll:', e.message);
  }
}

const pcAudioActive = isPcAudioEnabled();
applyAudioModeToDll(pcAudioActive);

const lanMac = 'c8:53:09:dd:df:de';
const macNoColonsUpper = lanMac.replace(/:/g, '').toUpperCase();
const serverName = 'AndroProject [PC]';
const safeHost = 'AndroProject-PC.local';

let currentChild = null;
let shuttingDown = false;
let isStreamingActive = false;

function spawnAirPlayProcess() {
  if (shuttingDown) return;
  console.log('[AirPlay Daemon] Iniciando AirPlayServer.exe (Supervisor Activo)...');
  const child = spawn(airplayExe, [], {
    cwd: airplayDir,
    windowsHide: false,
    env: {
      ...process.env,
      PATH: `${airplayDir};${libDir};${gstDir};${process.env.PATH || ''}`,
      GST_PLUGIN_PATH: gstDir,
      GST_PLUGIN_SYSTEM_PATH: gstDir,
    },
  });

  currentChild = child;
  isStreamingActive = false;

  child.on('error', (err) => {
    console.error('[AirPlay Spawn Error]', err.message);
  });

  // AirPlayServer.exe writes to its own SDL console window, NOT stdout/stderr.
  // So we detect streaming state via netstat: if port 7001 has ESTABLISHED connection → streaming active.
  child.stdout.on('data', (d) => {
    const str = d.toString().trim();
    if (str) console.log('[AirPlay]', str);
  });

  child.stderr.on('data', (d) => {
    const str = d.toString().trim();
    if (str) console.error('[AirPlay ERR]', str);
  });

  child.on('exit', (code, sig) => {
    isStreamingActive = false;
    console.log(`[AirPlay Daemon] AirPlayServer finalizó (code=${code}, sig=${sig}). Reiniciando en 400ms...`);
    if (!shuttingDown) {
      setTimeout(spawnAirPlayProcess, 400);
    }
  });
}

// ── Detect active iOS mirror session via TCP ESTABLISHED on port 7001/5001 ───
let streamingCheckTimer = null;
function startStreamingDetection() {
  if (streamingCheckTimer) return;
  streamingCheckTimer = setInterval(() => {
    exec('netstat -ano -p TCP', { windowsHide: true, timeout: 2000 }, (err, stdout) => {
      if (err || !stdout) return;
      const lines = stdout.split('\n');
      const established = lines.some(line => {
        const m = line.match(/\s+(?:[\d.]+):(\d+)\s+[\d.:]+\s+ESTABLISHED/i);
        return m && (m[1] === '7001' || m[1] === '5001' || m[1] === '7000');
      });
      if (established && !isStreamingActive) {
        isStreamingActive = true;
        console.log('[AirPlay Daemon] >> STREAMING ACTIVO detectado (puerto 7001/5001 ESTABLISHED) — mDNS pausado.');
      } else if (!established && isStreamingActive) {
        isStreamingActive = false;
        console.log('[AirPlay Daemon] >> Conexión finalizada — mDNS reactivado.');
      }
    });
  }, 1000);
}
startStreamingDetection();

spawnAirPlayProcess();

function getAllActiveInterfaces() {
  const ifaces = os.networkInterfaces();
  const list = [];
  for (const name of Object.keys(ifaces)) {
    const lower = name.toLowerCase();
    if (lower.includes('wsl') || lower.includes('hyper-v') || lower.includes('loopback') || lower.includes('tailscale') || lower.includes('vpn')) continue;
    for (const net of ifaces[name] || []) {
      if (net.family === 'IPv4' && !net.internal && !net.address.startsWith('169.254.')) {
        const isWifi = lower.includes('wi-fi') || lower.includes('wlan') || lower.includes('wireless');
        const isEthernet = lower.includes('ethernet') || lower.includes('eth');
        const isHotspot = net.address.startsWith('172.20.10.') || net.address.startsWith('192.168.137.');
        list.push({
          name,
          ip: net.address,
          subnetPrefix: net.address.split('.').slice(0, 3).join('.'),
          isWifi,
          isEthernet,
          isHotspot,
        });
      }
    }
  }

  // Deduplicate by subnetPrefix:
  // For the local router subnet (192.168.0.x), prefer Wi-Fi because iPhones connect wirelessly
  // and home routers often block multicast between Wi-Fi and Ethernet.
  // Hotspot (192.168.137.x) and Tethering (172.20.10.x) have unique subnets and are always included.
  const bySubnet = new Map();
  list.sort((a, b) => (b.isWifi ? 1 : 0) - (a.isWifi ? 1 : 0));
  for (const iface of list) {
    if (!bySubnet.has(iface.subnetPrefix)) {
      bySubnet.set(iface.subnetPrefix, iface);
    }
  }
  return Array.from(bySubnet.values());
}

function buildBonjourPacket(primaryIp, allIps, flushFlag) {
  const airplayService = `${serverName}._airplay._tcp.local`;
  const raopService = `${macNoColonsUpper}@${serverName}._raop._tcp.local`;
  const featStr = isPcAudioEnabled() ? '0x5A7FFEE6,0x0' : '0x5A7FFCE6,0x0';

  const answers = [
    { name: '_services._dns-sd._udp.local', type: 'PTR', ttl: 4500, data: '_airplay._tcp.local' },
    { name: '_services._dns-sd._udp.local', type: 'PTR', ttl: 4500, data: '_raop._tcp.local' },
    { name: '_airplay._tcp.local', type: 'PTR', ttl: 4500, data: airplayService },
    { name: '_raop._tcp.local', type: 'PTR', ttl: 4500, data: raopService },
    {
      name: airplayService,
      type: 'SRV',
      ttl: 4500,
      flush: flushFlag,
      data: { port: 7001, target: safeHost, priority: 0, weight: 0 },
    },
    {
      name: airplayService,
      type: 'TXT',
      ttl: 4500,
      flush: flushFlag,
      data: [
        'srcvers=845.5.1',
        `deviceid=${lanMac}`,
        `features=${featStr}`,
        'model=AppleTV14,1',
        'flags=0x4',
        'pw=false',
        'vv=2',
      ],
    },
    {
      name: raopService,
      type: 'SRV',
      ttl: 4500,
      flush: flushFlag,
      data: { port: 5001, target: safeHost, priority: 0, weight: 0 },
    },
    {
      name: raopService,
      type: 'TXT',
      ttl: 4500,
      flush: flushFlag,
      data: [
        'txtvers=1',
        'ch=2',
        'cn=0,1,3',
        'et=0,3,5',
        'sv=false',
        'da=true',
        'sr=44100',
        'ss=16',
        'pw=false',
        'vn=3',
        'tp=TCP,UDP',
        'md=0,1,2',
        'vs=845.5.1',
        'sm=false',
        'ek=1',
        'sf=0x4',
        `ft=${featStr}`,
        'am=AppleTV14,1',
      ],
    },
    // Only ONE A record per packet = the IP of the interface sending this packet.
    {
      name: safeHost,
      type: 'A',
      ttl: 4500,
      flush: true,
      data: primaryIp,
    },
  ];

  return { answers };
}

const activeSockets = new Map();
let dynamicArpTargets = new Set();

function refreshArpTargets() {
  exec('arp -a', { windowsHide: true, timeout: 2000 }, (err, stdout) => {
    if (err || !stdout) return;
    const next = new Set();
    const matches = stdout.match(/\b(?:192\.168\.\d+\.\d+|172\.20\.10\.\d+|10\.\d+\.\d+\.\d+|169\.254\.\d+\.\d+)\b/g) || [];
    for (const ip of matches) {
      if (!ip.endsWith('.1') || ip === '172.20.10.1') {
        if (!ip.endsWith('.255') && !activeSockets.has(ip)) {
          next.add(ip);
        }
      }
    }
    dynamicArpTargets = next;
  });
}

function syncInterfaces(announce = false) {
  if (isStreamingActive) return;

  const allIfaces = getAllActiveInterfaces();
  const currentIps = new Set(allIfaces.map((i) => i.ip));

  for (const [ip, entry] of activeSockets.entries()) {
    if (!currentIps.has(ip)) {
      try { entry.inst.destroy(); } catch (e) {}
      activeSockets.delete(ip);
    }
  }

  for (const iface of allIfaces) {
    if (!activeSockets.has(iface.ip)) {
      try {
        const inst = createMdns({ bind: '0.0.0.0', interface: iface.ip, reuseAddr: true });
        inst.on('error', () => {});
        inst.on('query', (query, rinfo) => {
          if (isStreamingActive) return;
          const relevant = (query.questions || []).some((q) => {
            const n = (q.name || '').toLowerCase();
            return (
              n.includes('_airplay._tcp') ||
              n.includes('_raop._tcp') ||
              n.includes('_dns-sd._udp') ||
              n.includes('androproject')
            );
          });
          if (relevant) {
            const pkt = buildBonjourPacket(iface.ip, null, false);
            try {
              inst.respond(pkt);
              if (rinfo && rinfo.address && rinfo.port) {
                inst.respond(pkt, rinfo);
              }
            } catch (e) {}
          }
        });
        activeSockets.set(iface.ip, { inst, iface });
      } catch (e) {}
    }
  }

  if (announce && !isStreamingActive) {
    for (const [ip, { inst, iface }] of activeSockets.entries()) {
      const pkt = buildBonjourPacket(iface.ip, null, false);
      try {
        inst.respond(pkt);
        for (const peerIp of dynamicArpTargets) {
          if (peerIp.startsWith(iface.subnetPrefix + '.')) {
            inst.respond(pkt, { address: peerIp, port: 5353 });
          }
        }
      } catch (e) {}
    }
  }
}

// Initial announcement pulses for instant discovery
refreshArpTargets();
syncInterfaces(true);
setTimeout(() => syncInterfaces(true), 600);
setTimeout(() => syncInterfaces(true), 1600);

// While IDLE: broadcast to keep device visible in Screen Mirroring menu.
// When STREAMING: completely silent.
setInterval(() => {
  if (!isStreamingActive) {
    syncInterfaces(true);
  }
}, 3500);

setInterval(refreshArpTargets, 8000);

function handleExit() {
  shuttingDown = true;
  for (const [, { inst }] of activeSockets.entries()) {
    try { inst.destroy(); } catch (e) {}
  }
  if (currentChild) {
    try { currentChild.kill(); } catch (e) {}
  }
  process.exit(0);
}

process.on('SIGINT', handleExit);
process.on('SIGTERM', handleExit);
