const { spawn } = require('child_process');
const path = require('path');
const airplayDir = path.join(__dirname, '..', 'androproject-gui', 'bin', 'airplay');
const airplayExe = path.join(airplayDir, 'AirPlayServer.exe');

const p = spawn(airplayExe, [], {
  cwd: airplayDir,
  env: {
    ...process.env,
    PATH: airplayDir + ';' + path.join(airplayDir, 'lib') + ';' + process.env.PATH
  }
});

p.stdout.on('data', d => console.log('STDOUT:', d.toString()));
p.stderr.on('data', d => console.log('STDERR:', d.toString()));
p.on('exit', code => console.log('EXIT CODE:', code));
p.on('error', err => console.error('ERROR:', err));

setTimeout(() => {
  console.log('Still running after 3s...');
}, 3000);
