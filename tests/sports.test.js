import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resetDb, createTeam, registerAndLogin, as } from './helpers.js';

let api;
let team;
let alumno;

const newItem = (over = {}) => ({ codigo: 'dep-01', nombre: 'Balón Fútbol #5', deporte: 'Fútbol', estadoFisico: 'NUEVO', cantidadTotal: 10, ...over });

before(async () => {
  api = await setup();
});
after(teardown);
beforeEach(async () => {
  await resetDb();
  team = await createTeam(api, 'equipo-b1', ['B']);
  alumno = await registerAndLogin(api, team.token);
});

const createItem = async (over) => {
  const r = await as(api.post('/api/sports/items'), team.token, team.adminToken).send(newItem(over));
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return r.body;
};

const lend = (tok, body) => as(api.post('/api/sports/loans'), team.token, tok).send(body);

describe('Ítems deportivos', () => {
  it('ADMIN crea ítem (código en mayúsculas, disponibles = total)', async () => {
    const i = await createItem();
    assert.equal(i.codigo, 'DEP-01');
    assert.equal(i.disponibles, 10);
  });

  it('USER → 403 al crear; estadoFisico inválido → 400', async () => {
    assert.equal((await as(api.post('/api/sports/items'), team.token, alumno.token).send(newItem())).status, 403);
    assert.equal((await as(api.post('/api/sports/items'), team.token, team.adminToken).send(newItem({ estadoFisico: 'ROTO' }))).status, 400);
  });

  it('filtros por deporte y disponibilidad', async () => {
    await createItem();
    await createItem({ codigo: 'DEP-02', nombre: 'Balón Básquet', deporte: 'Básquetbol', cantidadTotal: 0 });
    const futbol = await as(api.get('/api/sports/items?deporte=fútbol'), team.token, alumno.token);
    assert.deepEqual(futbol.body.map((i) => i.codigo), ['DEP-01']);
    const disp = await as(api.get('/api/sports/items?disponible=true'), team.token, alumno.token);
    assert.deepEqual(disp.body.map((i) => i.codigo), ['DEP-01']);
    const sports = await as(api.get('/api/sports/items/sports'), team.token, alumno.token);
    assert.deepEqual(sports.body, ['Básquetbol', 'Fútbol']);
  });

  it('PATCH actualiza estadoFisico y cantidadTotal conservando lo prestado', async () => {
    const i = await createItem({ cantidadTotal: 10 });
    await lend(alumno.token, { itemId: i.id, cantidad: 3, canchaOActividad: 'Cancha 1' });
    const r = await as(api.patch(`/api/sports/items/${i.id}`), team.token, team.adminToken).send({ estadoFisico: 'DESGASTADO', cantidadTotal: 9 });
    assert.equal(r.status, 200);
    assert.equal(r.body.message, 'Ítem actualizado');
    assert.deepEqual([r.body.item.estadoFisico, r.body.item.cantidadTotal, r.body.item.disponibles], ['DESGASTADO', 9, 6]);
    assert.equal((await as(api.patch(`/api/sports/items/${i.id}`), team.token, team.adminToken).send({ cantidadTotal: 2 })).status, 409);
  });
});

describe('Préstamos deportivos', () => {
  it('no permite pedir más de lo disponible', async () => {
    const i = await createItem({ cantidadTotal: 2 });
    const r = await lend(alumno.token, { itemId: i.id, cantidad: 3, canchaOActividad: 'Cancha 2' });
    assert.equal(r.status, 409);
    assert.match(r.body.message, /Solo hay 2/);
    assert.equal((await lend(alumno.token, { itemId: i.id, cantidad: 0, canchaOActividad: 'x' })).status, 400);
    assert.equal((await lend(alumno.token, { itemId: i.id, cantidad: 1 })).status, 400);
  });

  it('flujo: préstamo ACTIVO → recepción BUENO devuelve disponibles', async () => {
    const i = await createItem({ cantidadTotal: 8 });
    const loan = await lend(alumno.token, { itemId: i.id, cantidad: 2, canchaOActividad: 'Cancha 2 - Torneo' });
    assert.equal(loan.status, 201);
    assert.equal(loan.body.estatus, 'ACTIVO');
    assert.ok(loan.body.horaSalida);
    assert.equal((await as(api.get(`/api/sports/items/${i.id}`), team.token, alumno.token)).body.disponibles, 6);

    assert.equal((await as(api.patch(`/api/sports/loans/${loan.body.loanId}/return`), team.token, alumno.token).send({ estadoDevolucion: 'BUENO' })).status, 403);

    const ret = await as(api.patch(`/api/sports/loans/${loan.body.loanId}/return`), team.token, team.adminToken).send({ estadoDevolucion: 'BUENO', notas: 'ok' });
    assert.equal(ret.status, 200);
    assert.equal(ret.body.estatus, 'FINALIZADO');
    assert.equal(ret.body.estadoDevolucion, 'BUENO');
    const item = (await as(api.get(`/api/sports/items/${i.id}`), team.token, alumno.token)).body;
    assert.deepEqual([item.disponibles, item.cantidadTotal], [8, 8]);
    assert.equal((await as(api.patch(`/api/sports/loans/${loan.body.loanId}/return`), team.token, team.adminToken).send({ estadoDevolucion: 'BUENO' })).status, 409);
  });

  it('recepción DAÑADO (con Ñ) da de baja el material', async () => {
    const i = await createItem({ cantidadTotal: 8 });
    const loan = await lend(alumno.token, { itemId: i.id, cantidad: 2, canchaOActividad: 'Gimnasio' });
    const ret = await as(api.patch(`/api/sports/loans/${loan.body.loanId}/return`), team.token, team.adminToken).send({ estadoDevolucion: 'DAÑADO', notas: 'Ponchado' });
    assert.equal(ret.status, 200);
    assert.equal(ret.body.estadoDevolucion, 'DANADO');
    const item = (await as(api.get(`/api/sports/items/${i.id}`), team.token, alumno.token)).body;
    assert.deepEqual([item.disponibles, item.cantidadTotal], [6, 6]);
  });

  it('USER ve solo sus préstamos, ADMIN todos', async () => {
    const i = await createItem();
    const otro = await registerAndLogin(api, team.token, 2);
    await lend(alumno.token, { itemId: i.id, cantidad: 1, canchaOActividad: 'A' });
    await lend(otro.token, { itemId: i.id, cantidad: 1, canchaOActividad: 'B' });
    const mine = await as(api.get('/api/sports/loans'), team.token, alumno.token);
    assert.equal(mine.body.length, 1);
    assert.equal(mine.body[0].item, 'Balón Fútbol #5');
    assert.equal(mine.body[0].usuario, 'Alumno 1');
    assert.equal((await as(api.get('/api/sports/loans?estatus=ACTIVO'), team.token, team.adminToken)).body.length, 2);
  });

  it('equipo del proyecto A recibe 403 en /api/sports', async () => {
    const teamA = await createTeam(api, 'equipo-a1', ['A']);
    assert.equal((await as(api.get('/api/sports/items'), teamA.token, teamA.adminToken)).status, 403);
  });
});
