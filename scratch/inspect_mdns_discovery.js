const path = require('path');
const mdns = require(path.join(__dirname, '..', 'androproject-gui', 'node_modules', 'multicast-dns'))();

console.log('--- Buscando servicios AirPlay en la red local (Simulando iPhone) ---');

mdns.on('response', (response) => {
  const airplayAnswers = response.answers.filter(a => 
    a.name.includes('_airplay') || a.name.includes('_raop') || a.name.includes('Emma') || a.name.includes('AndroProject')
  );

  if (airplayAnswers.length > 0) {
    console.log('\n[ENCONTRADO] Respuesta AirPlay recibida:');
    response.answers.forEach(a => {
      console.log(` -> Tipo: ${a.type} | Nombre: ${a.name} | Data:`, typeof a.data === 'object' ? JSON.stringify(a.data) : a.data);
    });
  }
});

// Enviar consultas mDNS como lo hace un iPhone
mdns.query({
  questions: [
    { name: '_airplay._tcp.local', type: 'PTR' },
    { name: '_raop._tcp.local', type: 'PTR' }
  ]
});

setTimeout(() => {
  console.log('\nPrueba finalizada.');
  process.exit(0);
}, 4000);
