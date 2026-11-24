import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import request from 'supertest';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'secreto-de-pruebas';

const { createApp } = await import('../src/app.js');
const { App, generateAppToken } = await import('../src/models/App.js');
const { User } = await import('../src/models/User.js');
const { clearAppTokenCache } = await import('../src/middlewares/appToken.js');

let mongod;

export async function setup() {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
  await mongoose.connection.syncIndexes();
  return request(createApp());
}

export async function teardown() {
  await mongoose.disconnect();
  await mongod?.stop();
}

export async function resetDb() {
  clearAppTokenCache();
  await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})));
}

/** Crea un equipo con su token y un ADMIN. Devuelve { token, adminToken, admin }. */
export async function createTeam(api, nombre, proyectos = ['A', 'B', 'C']) {
  const app = await App.create({ nombre, proyectos, token: generateAppToken(nombre) });
  const admin = await User.create({
    appId: app._id,
    nombre: `Admin ${nombre}`,
    matricula: `ADM-${nombre}`,
    email: `admin@${nombre}.utr`,
    password: await bcrypt.hash('Admin123', 10),
    rol: 'ADMIN',
  });
  const adminToken = await login(api, app.token, admin.email, 'Admin123');
  return { token: app.token, adminToken, admin, app };
}

export async function registerAndLogin(api, appTok, n = 1) {
  const body = { nombre: `Alumno ${n}`, matricula: `UTR${1000 + n}`, email: `alumno${n}@utr.mx`, password: 'secreta1' };
  const r = await api.post('/api/auth/register').set('x-api-token', appTok).send(body);
  if (r.status !== 201) throw new Error(`register falló: ${r.status} ${JSON.stringify(r.body)}`);
  const token = await login(api, appTok, body.email, body.password);
  return { token, user: r.body.user };
}

export async function login(api, appTok, email, password) {
  const r = await api.post('/api/auth/login').set('x-api-token', appTok).send({ email, password });
  if (r.status !== 200) throw new Error(`login falló: ${r.status} ${JSON.stringify(r.body)}`);
  return r.body.token;
}

/** Atajo: headers de doble token. */
export const as = (req, appTok, userTok) => {
  req.set('x-api-token', appTok);
  if (userTok) req.set('Authorization', `Bearer ${userTok}`);
  return req;
};
