import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { App, generateAppToken, PROYECTOS } from '../../src/models/App.js';
import { User } from '../../src/models/User.js';
import { Book } from '../../src/models/library.js';
import { SportItem } from '../../src/models/sports.js';
import { Computer, Equipment } from '../../src/models/labs.js';
import { SAMPLE_BOOKS, SAMPLE_SPORT_ITEMS, sampleComputers, SAMPLE_EQUIPMENT } from './sample-data.js';

const randomPassword = () => `Utr-${crypto.randomBytes(5).toString('base64url')}`;

/**
 * Crea (si no existe) un equipo con su x-api-token, un ADMIN, un alumno demo y datos de ejemplo.
 * Si el equipo ya existe no cambia su token ni contraseñas.
 */
export async function provisionTeam({ nombre, proyectos, withSampleData = true }) {
  nombre = nombre.trim().toLowerCase();
  if (!/^[a-z0-9-]{3,40}$/.test(nombre)) throw new Error(`Nombre de equipo inválido: "${nombre}" (usa a-z, 0-9 y guiones)`);
  const bad = proyectos.filter((p) => !PROYECTOS.includes(p));
  if (!proyectos.length || bad.length) throw new Error(`Proyectos inválidos: ${proyectos.join(',')} (usa A, B y/o C)`);

  let app = await App.findOne({ nombre });
  const result = { nombre, proyectos, created: false, credenciales: [] };

  if (!app) {
    app = await App.create({ nombre, proyectos, token: generateAppToken(nombre) });
    result.created = true;

    const users = [
      { nombre: `Administrador ${nombre}`, matricula: `ADMIN-${nombre.toUpperCase()}`, email: `admin@${nombre}.utr`, rol: 'ADMIN' },
      { nombre: `Alumno Demo ${nombre}`, matricula: `DEMO-${nombre.toUpperCase()}`, email: `alumno@${nombre}.utr`, rol: 'USER' },
    ];
    for (const u of users) {
      const password = randomPassword();
      await User.create({ ...u, appId: app._id, password: await bcrypt.hash(password, 10) });
      result.credenciales.push({ rol: u.rol, email: u.email, password });
    }
  }

  result.token = app.token;
  if (withSampleData) result.datos = await seedSampleData(app);
  return result;
}

/** Inserta datos de ejemplo solo si la colección del equipo está vacía. */
async function seedSampleData(app) {
  const appId = app._id;
  const summary = {};
  const fill = async (Model, rows, key) => {
    if (await Model.exists({ appId })) return;
    // create() uno por uno para que se asigne el id numérico secuencial
    for (const row of rows) await Model.create({ ...row, appId });
    summary[key] = rows.length;
  };

  if (app.proyectos.includes('A')) {
    await fill(Book, SAMPLE_BOOKS.map((b) => ({ ...b, stockDisponible: b.stockTotal })), 'libros');
  }
  if (app.proyectos.includes('B')) {
    await fill(SportItem, SAMPLE_SPORT_ITEMS.map((i) => ({ ...i, disponibles: i.cantidadTotal })), 'articulosDeportivos');
  }
  if (app.proyectos.includes('C')) {
    await fill(Computer, sampleComputers(), 'computadoras');
    await fill(Equipment, SAMPLE_EQUIPMENT, 'perifericos');
  }
  return summary;
}
