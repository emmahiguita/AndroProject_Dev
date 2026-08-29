const { spawn } = require('child_process');
const path = require('path');

const airplayDir = path.join(__dirname, '..', 'androproject-gui', 'bin', 'airplay');
const uxplayExe = path.join(airplayDir, 'uxplay-windows.exe');

const env = {
  ...process.env,
  PATH: `${airplayDir};${path.join(airplayDir, 'lib')};${path.join(airplayDir, 'platforms')};${process.env.PATH}`,
  GST_PLUGIN_PATH: path.join(airplayDir, 'lib', 'gstreamer-1.0'),
  GST_DEBUG: '2',
};

const args = [
  '-n', 'AndroProject [PC]',
  '-nh',
  '-fps', '60',
  '-vs', 'autovideosink',
  '-as', 'wasapisink'
];

console.log('Launching UxPlay with command:', uxplayExe, args.join(' '));

const p = spawn(uxplayExe, args, {
  cwd: airplayDir,
  env,
  stdio: ['ignore', 'pipe', 'pipe']
});

p.stdout.on('data', d => console.log('[UxPlay STDOUT]:', d.toString()));
p.stderr.on('data', d => console.log('[UxPlay STDERR]:', d.toString()));
p.on('exit', code => console.log('[UxPlay EXIT]:', code));
p.on('error', err => console.error('[UxPlay ERROR]:', err));

setTimeout(() => {
  console.log('UxPlay is running and broadcasting Bonjour actively!');
}, 3000);
