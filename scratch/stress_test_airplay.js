const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const airplayDir = path.join(__dirname, '..', 'androproject-gui', 'bin', 'airplay');
const uxplayExe = path.join(airplayDir, 'uxplay-windows.exe');

const env = {
  ...process.env,
  PATH: `${airplayDir};${path.join(airplayDir, 'lib')};${process.env.PATH}`,
  GST_PLUGIN_PATH: path.join(airplayDir, 'lib', 'gstreamer-1.0'),
  GST_DEBUG: '1',
};

const args = [
  '-n', 'AndroProject [PC]',
  '-nh',
  '-vs', 'd3d11videosink',
  '-as', 'wasapisink',
  '-s', '1179x2556@60',
  '-fps', '60',
  '-p', '7000'
];

console.log('[STRESS TEST] Iniciando UxPlay con renderizador Direct3D11 explícito...');
console.log('[STRESS TEST] Comando:', uxplayExe, args.join(' '));

const p = spawn(uxplayExe, args, {
  cwd: airplayDir,
  env,
  stdio: ['ignore', 'pipe', 'pipe']
});

p.stdout.on('data', d => console.log('[UXPLAY STDOUT]:', d.toString().trim()));
p.stderr.on('data', d => console.log('[UXPLAY STDERR]:', d.toString().trim()));
p.on('exit', code => console.log('[UXPLAY EXIT]:', code));
p.on('error', err => console.error('[UXPLAY ERROR]:', err));

console.log('[STRESS TEST] Servidor AirPlay listo y esperando transmisión...');
