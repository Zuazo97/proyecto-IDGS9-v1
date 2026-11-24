import { PROYECTO_NOMBRE } from '../../src/models/App.js';

export function printResults(results) {
  for (const r of results) {
    console.log('\n' + '='.repeat(72));
    console.log(`Equipo: ${r.nombre}   Proyecto(s): ${r.proyectos.map((p) => `${p} (${PROYECTO_NOMBRE[p]})`).join(', ')}`);
    console.log(`x-api-token: ${r.token}`);
    if (r.created) {
      for (const c of r.credenciales) console.log(`  ${c.rol.padEnd(5)}  ${c.email}  /  ${c.password}`);
    } else {
      console.log('  (ya existía: token y contraseñas sin cambios)');
    }
    if (r.datos && Object.keys(r.datos).length) console.log(`  Datos de ejemplo: ${JSON.stringify(r.datos)}`);
  }
  console.log('='.repeat(72));
}
