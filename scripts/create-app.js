// Crea un equipo nuevo con su x-api-token.
// Uso: npm run app:create -- equipo-a2 A
//      npm run app:create -- equipo-mixto A,B --sin-datos
import fs from 'node:fs';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { assertEnv, env } from '../src/config/env.js';
import { provisionTeam } from './lib/provision.js';
import { printResults } from './lib/print.js';

const args = process.argv.slice(2);
const [nombre, proyectosArg] = args.filter((a) => !a.startsWith('--'));
if (!nombre || !proyectosArg) {
  console.error('Uso: npm run app:create -- <nombre-equipo> <A|B|C|A,B,...> [--sin-datos]');
  process.exit(1);
}

assertEnv();
await connectDB(env.mongoUri);
try {
  const r = await provisionTeam({
    nombre,
    proyectos: proyectosArg.toUpperCase().split(',').map((p) => p.trim()),
    withSampleData: !args.includes('--sin-datos'),
  });
  printResults([r]);
  if (r.created) {
    const file = `seed-output-${r.nombre}.json`;
    fs.writeFileSync(file, JSON.stringify(r, null, 2));
    console.log(`\nCredenciales guardadas en ${file} (está en .gitignore).`);
  }
} catch (err) {
  console.error(`Error: ${err.message}`);
  process.exitCode = 1;
} finally {
  await disconnectDB();
}
