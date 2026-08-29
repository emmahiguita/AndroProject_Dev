const { spawn } = require('child_process');
const path = require('path');

const airplayDir = path.join(__dirname, '..', 'androproject-gui', 'bin', 'airplay');
const uxplayExe = path.join(airplayDir, 'uxplay-windows.exe');

const env = {
  ...process.env,
  PATH: `${airplayDir};${path.join(airplayDir, 'lib')};${process.env.PATH}`,
  GST_PLUGIN_PATH: path.join(airplayDir, 'lib', 'gstreamer-1.0')
};

const args = [
  '-n', 'AndroProject [PC]',
  '-nh'
];

console.log('Launching UxPlay standalone:', uxplayExe, args.join(' '));

const child = spawn(uxplayExe, args, {
  cwd: airplayDir,
  env,
  detached: true,
  stdio: 'inherit'
});

child.unref();
console.log('UxPlay spawned on Windows Desktop session successfully!');
