// Crea los equipos iniciales con su x-api-token, usuarios y datos de ejemplo.
// Uso: npm run seed            (idempotente: no toca equipos que ya existen)
import fs from 'node:fs';
import { connectDB, disconnectDB } from '../src/config/db.js';
import { assertEnv, env } from '../src/config/env.js';
import { provisionTeam } from './lib/provision.js';
import { printResults } from './lib/print.js';

const TEAMS = [
  { nombre: 'equipo-a1', proyectos: ['A'] },
  { nombre: 'equipo-b1', proyectos: ['B'] },
  { nombre: 'equipo-c1', proyectos: ['C'] },
  // Para el docente: acceso a los tres proyectos (revisión / demos)
  { nombre: 'docente', proyectos: ['A', 'B', 'C'] },
];

assertEnv();
await connectDB(env.mongoUri);

const results = [];
for (const t of TEAMS) results.push(await provisionTeam(t));

printResults(results);

const newOnes = results.filter((r) => r.created);
if (newOnes.length) {
  const file = `seed-output-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.json`;
  fs.writeFileSync(file, JSON.stringify(newOnes, null, 2));
  console.log(`\nCredenciales guardadas en ${file} (está en .gitignore, NO lo subas al repo).`);
}

await disconnectDB();
