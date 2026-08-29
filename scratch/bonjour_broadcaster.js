const path = require('path');
const mdns = require(path.join(__dirname, '..', 'androproject-gui', 'node_modules', 'multicast-dns'));
const os = require('os');

// Encuentra la IP local de Wi-Fi
function getLocalWifiIp() {
  const ifaces = os.networkInterfaces();
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal && iface.address.startsWith('192.168.0.')) {
        return iface.address;
      }
    }
  }
  return '192.168.0.5';
}

const localIp = getLocalWifiIp();
const serverName = 'AndroProject [PC]';
const deviceId = '58:55:ca:1a:e2:88';
const hostName = 'Emma.local';
const port = 7000;

console.log(`==========================================================`);
console.log(` [BONJOUR MDNS] Anunciando AirPlay 2 en ${localIp}:5353`);
console.log(` Nombre: "${serverName}" -> Host: ${hostName}:${port}`);
console.log(`==========================================================`);

const m = mdns({
  interface: localIp,
  multicast: true,
  port: 5353,
  reuseAddr: true
});

const airplayTxt = [
  'flags=0x4',
  'model=AppleTV3,2',
  'srcvers=220.68',
  'features=0x5A7FFFF7,0x1E',
  `deviceid=${deviceId}`,
  'vv=2',
  'pk=b07727d6f6cd5e08b58ede525ec3cdeaa252ad9f683fedc4d1fac80f9b589f35',
  'pi=2e388006-13ba-4041-9a67-25b1a4a278b4',
  'psi=2e388006-13ba-4041-9a67-25b1a4a278b4',
  'statusFlags=0',
  'sf=0x4'
];

const raopTxt = [
  'txtvers=1',
  'ch=2',
  'cn=0,1,2,3',
  'da=true',
  'et=0,3,5',
  'vv=2',
  'ft=0x5A7FFFF7,0x1E',
  'am=AppleTV3,2',
  'md=0,1,2',
  'rhd=5.6.0.0',
  'pw=false',
  'sr=44100',
  'ss=16',
  'sv=false',
  'tp=UDP',
  'vn=65537',
  'sf=0x4'
];

function broadcast() {
  const raopName = `${deviceId.replace(/:/g, '')}@${serverName}._raop._tcp.local`;
  const airplayName = `${serverName}._airplay._tcp.local`;

  m.respond([
    // PTR
    { name: '_airplay._tcp.local', type: 'PTR', data: airplayName, ttl: 120 },
    { name: '_raop._tcp.local', type: 'PTR', data: raopName, ttl: 120 },

    // SRV
    { name: airplayName, type: 'SRV', data: { priority: 0, weight: 0, port: port, target: hostName }, ttl: 120 },
    { name: raopName, type: 'SRV', data: { priority: 0, weight: 0, port: port, target: hostName }, ttl: 120 },

    // TXT
    { name: airplayName, type: 'TXT', data: airplayTxt, ttl: 120 },
    { name: raopName, type: 'TXT', data: raopTxt, ttl: 120 },

    // A
    { name: hostName, type: 'A', data: localIp, ttl: 120 },
    { name: 'AndroProject.local', type: 'A', data: localIp, ttl: 120 }
  ], () => {
    // broadcast ack
  });
}

m.on('query', (query) => {
  const isAirPlayQuery = query.questions.some(q => 
    q.name.includes('_airplay._tcp') || 
    q.name.includes('_raop._tcp') ||
    q.name.includes('Emma.local') ||
    q.name.includes('AndroProject')
  );

  if (isAirPlayQuery) {
    console.log(`[mDNS] Consulta AirPlay detectada desde iPhone en la red -> Respondiendo.`);
    broadcast();
  }
});

// Enviar anuncio inicial y repetir cada 3 segundos
broadcast();
setInterval(broadcast, 3000);
