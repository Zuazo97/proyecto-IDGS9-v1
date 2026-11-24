import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resetDb, createTeam, registerAndLogin, as } from './helpers.js';

let api;
let team;

before(async () => {
  api = await setup();
});
after(teardown);
beforeEach(async () => {
  await resetDb();
  team = await createTeam(api, 'equipo-test');
});

describe('Salud y app token', () => {
  it('GET /api/health es público', async () => {
    const r = await api.get('/api/health');
    assert.equal(r.status, 200);
    assert.equal(r.body.status, 'ok');
  });

  it('sin x-api-token → 401 APP_TOKEN_MISSING', async () => {
    const r = await api.post('/api/auth/login').send({ email: 'a@a.com', password: 'x' });
    assert.equal(r.status, 401);
    assert.equal(r.body.code, 'APP_TOKEN_MISSING');
  });

  it('x-api-token inválido → 401 APP_TOKEN_INVALID', async () => {
    const r = await api.post('/api/auth/login').set('x-api-token', 'falso').send({ email: 'a@a.com', password: 'x' });
    assert.equal(r.status, 401);
    assert.equal(r.body.code, 'APP_TOKEN_INVALID');
  });

  it('ruta inexistente → 404', async () => {
    const r = await as(api.get('/api/no-existe'), team.token);
    assert.equal(r.status, 404);
  });
});

describe('Auth', () => {
  it('register crea USER aunque se envíe rol ADMIN', async () => {
    const r = await as(api.post('/api/auth/register'), team.token).send({
      nombre: 'Ana Pérez', matricula: 'UTR001', email: 'Ana@UTR.mx', password: 'secreta1', rol: 'ADMIN',
    });
    assert.equal(r.status, 201);
    assert.equal(r.body.message, 'Usuario registrado');
    assert.equal(r.body.user.rol, 'USER');
    assert.equal(r.body.user.email, 'ana@utr.mx');
    assert.equal(typeof r.body.user.id, 'number');
    assert.equal(r.body.user.password, undefined);
  });

  it('register valida campos → 400 con errores', async () => {
    const r = await as(api.post('/api/auth/register'), team.token).send({ email: 'malo' });
    assert.equal(r.status, 400);
    assert.ok(r.body.errors.length >= 3);
  });

  it('register con email duplicado → 409', async () => {
    const body = { nombre: 'Ana', matricula: 'UTR001', email: 'ana@utr.mx', password: 'secreta1' };
    await as(api.post('/api/auth/register'), team.token).send(body);
    const r = await as(api.post('/api/auth/register'), team.token).send({ ...body, matricula: 'UTR002' });
    assert.equal(r.status, 409);
    assert.equal(r.body.campo, 'email');
  });

  it('login correcto devuelve token y user con rol', async () => {
    const r = await as(api.post('/api/auth/login'), team.token).send({ email: 'admin@equipo-test.utr', password: 'Admin123' });
    assert.equal(r.status, 200);
    assert.match(r.body.token, /^eyJ/);
    assert.equal(r.body.user.rol, 'ADMIN');
    const payload = JSON.parse(Buffer.from(r.body.token.split('.')[1], 'base64url'));
    assert.deepEqual([payload.id, payload.rol, payload.matricula], [team.admin.id, 'ADMIN', team.admin.matricula]);
  });

  it('login incorrecto → 401', async () => {
    const r = await as(api.post('/api/auth/login'), team.token).send({ email: 'admin@equipo-test.utr', password: 'mala' });
    assert.equal(r.status, 401);
    assert.equal(r.body.code, 'INVALID_CREDENTIALS');
  });

  it('GET /api/auth/me sin Bearer → 401, con Bearer → 200', async () => {
    assert.equal((await as(api.get('/api/auth/me'), team.token)).status, 401);
    const r = await as(api.get('/api/auth/me'), team.token, team.adminToken);
    assert.equal(r.status, 200);
    assert.equal(r.body.user.rol, 'ADMIN');
  });
});

describe('Usuarios (ADMIN)', () => {
  it('USER → 403 en /api/users', async () => {
    const { token } = await registerAndLogin(api, team.token);
    const r = await as(api.get('/api/users'), team.token, token);
    assert.equal(r.status, 403);
  });

  it('ADMIN lista y busca por nombre/matrícula', async () => {
    await registerAndLogin(api, team.token, 1);
    await registerAndLogin(api, team.token, 2);
    const all = await as(api.get('/api/users'), team.token, team.adminToken);
    assert.equal(all.status, 200);
    assert.equal(all.body.length, 3);
    assert.deepEqual(Object.keys(all.body[0]).sort(), ['activo', 'createdAt', 'email', 'id', 'matricula', 'nombre', 'rol']);
    const r = await as(api.get('/api/users?search=utr1002'), team.token, team.adminToken);
    assert.equal(r.body.length, 1);
    assert.equal(r.body[0].nombre, 'Alumno 2');
  });

  it('PATCH role promueve y el cambio aplica de inmediato', async () => {
    const { token, user } = await registerAndLogin(api, team.token);
    const r = await as(api.patch(`/api/users/${user.id}/role`), team.token, team.adminToken).send({ rol: 'ADMIN' });
    assert.equal(r.status, 200);
    assert.equal(r.body.message, 'Rol actualizado');
    assert.equal(r.body.user.rol, 'ADMIN');
    // Su token viejo decía USER, pero el rol se lee de la BD:
    assert.equal((await as(api.get('/api/users'), team.token, token)).status, 200);
  });

  it('PATCH role con valor inválido → 400; id inexistente → 404', async () => {
    assert.equal((await as(api.patch(`/api/users/${team.admin.id}/role`), team.token, team.adminToken).send({ rol: 'ROOT' })).status, 400);
    assert.equal((await as(api.patch('/api/users/99999/role'), team.token, team.adminToken).send({ rol: 'USER' })).status, 404);
  });

  it('ADMIN no puede quitarse su propio rol', async () => {
    const r = await as(api.patch(`/api/users/${team.admin.id}/role`), team.token, team.adminToken).send({ rol: 'USER' });
    assert.equal(r.status, 409);
  });

  it('usuario desactivado no puede usar su token ni hacer login', async () => {
    const { token, user } = await registerAndLogin(api, team.token);
    const r = await as(api.patch(`/api/users/${user.id}/status`), team.token, team.adminToken).send({ activo: false });
    assert.equal(r.body.user.activo, false);
    assert.equal((await as(api.get('/api/auth/me'), team.token, token)).status, 401);
    const l = await as(api.post('/api/auth/login'), team.token).send({ email: user.email, password: 'secreta1' });
    assert.equal(l.status, 401);
  });
});

describe('Aislamiento entre equipos', () => {
  it('un JWT de un equipo no sirve con el x-api-token de otro', async () => {
    const other = await createTeam(api, 'equipo-otro');
    const r = await as(api.get('/api/users'), other.token, team.adminToken);
    assert.equal(r.status, 401);
  });

  it('el mismo email puede registrarse en dos equipos y cada ADMIN ve solo los suyos', async () => {
    const other = await createTeam(api, 'equipo-otro');
    await registerAndLogin(api, team.token, 1);
    await registerAndLogin(api, other.token, 1);
    const r = await as(api.get('/api/users'), other.token, other.adminToken);
    assert.equal(r.body.length, 2);
    assert.ok(r.body.every((u) => u.email !== 'admin@equipo-test.utr'));
  });
});
