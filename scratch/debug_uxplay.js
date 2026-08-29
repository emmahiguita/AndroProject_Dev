const { spawn } = require('child_process');
const path = require('path');

const airplayDir = path.join(__dirname, '..', 'androproject-gui', 'bin', 'airplay');
const uxplayExe = path.join(airplayDir, 'uxplay-windows.exe');

const env = {
  ...process.env,
  PATH: `${airplayDir};${path.join(airplayDir, 'lib')};${process.env.PATH}`,
  GST_PLUGIN_PATH: path.join(airplayDir, 'lib', 'gstreamer-1.0')
};

const p = spawn(uxplayExe, ['-n', 'AndroProject [PC]', '-nh'], {
  cwd: airplayDir,
  env
});

p.stdout.on('data', d => console.log('STDOUT:', d.toString()));
p.stderr.on('data', d => console.log('STDERR:', d.toString()));
p.on('exit', code => console.log('EXIT CODE:', code));
p.on('error', err => console.error('ERROR:', err));
