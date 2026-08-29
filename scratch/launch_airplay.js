const { spawn } = require('child_process');
const path = require('path');
const airplayDir = path.join(__dirname, '..', 'androproject-gui', 'bin', 'airplay');
const airplayExe = path.join(airplayDir, 'AirPlayServer.exe');

console.log('Launching AirPlayServer from:', airplayExe);
const p = spawn(airplayExe, [], {
  cwd: airplayDir,
  detached: true,
  stdio: 'ignore'
});
p.unref();
console.log('AirPlayServer launched successfully without PIN!');
