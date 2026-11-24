// Lista los equipos, su token y cuántos usuarios tienen.
// Uso: npm run app:list
import { connectDB, disconnectDB } from '../src/config/db.js';
import { assertEnv, env } from '../src/config/env.js';
import { App } from '../src/models/App.js';
import { User } from '../src/models/User.js';

assertEnv();
await connectDB(env.mongoUri);

const apps = await App.find().sort({ nombre: 1 }).lean();
const rows = await Promise.all(
  apps.map(async (a) => ({
    equipo: a.nombre,
    proyectos: a.proyectos.join(','),
    activo: a.activo,
    usuarios: await User.countDocuments({ appId: a._id }),
    'x-api-token': a.token,
  })),
);
console.table(rows);
await disconnectDB();
