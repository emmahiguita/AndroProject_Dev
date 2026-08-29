const { spawn } = require('child_process');
const path = require('path');

const airplayDir = __dirname;
const airplayExe = path.join(airplayDir, 'AirPlayServer.exe');

console.log('[AirPlay Daemon] Iniciando AirPlayServer.exe...');

const child = spawn(airplayExe, [], {
  cwd: airplayDir,
  env: {
    ...process.env,
    PATH: airplayDir + ';' + path.join(airplayDir, 'lib') + ';' + process.env.PATH,
  }
});

child.stdout.on('data', d => {
  const str = d.toString().trim();
  if (str) console.log('[AirPlay]', str);
});

child.stderr.on('data', d => {
  const str = d.toString().trim();
  if (str) console.error('[AirPlay ERR]', str);
});

child.on('exit', (code, sig) => {
  console.log(`[AirPlay Daemon] Proceso finalizado con código ${code}, señal ${sig}`);
  process.exit(code || 0);
});
