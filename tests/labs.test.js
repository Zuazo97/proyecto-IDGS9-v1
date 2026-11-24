import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resetDb, createTeam, registerAndLogin, as } from './helpers.js';

let api;
let team;
let alumno;

const newPc = (over = {}) => ({
  numeroInventario: 'utr-pc-01', laboratorio: 'Lab-A', especificaciones: 'Core i7, 16GB RAM',
  perifericosIncluidos: ['Monitor', 'Teclado', 'Mouse'], ...over,
});

before(async () => {
  api = await setup();
});
after(teardown);
beforeEach(async () => {
  await resetDb();
  team = await createTeam(api, 'equipo-c1', ['C']);
  alumno = await registerAndLogin(api, team.token);
});

const createPc = async (over) => {
  const r = await as(api.post('/api/labs/computers'), team.token, team.adminToken).send(newPc(over));
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return r.body;
};
const assign = (tok, body) => as(api.post('/api/labs/assignments'), team.token, tok).send(body);
const release = (tok, id, body = {}) => as(api.patch(`/api/labs/assignments/${id}/release`), team.token, tok).send(body);
const getPc = async (id) => (await as(api.get(`/api/labs/computers/${id}`), team.token, team.adminToken)).body;

describe('Computadoras y equipo', () => {
  it('ADMIN registra PC (estatus DISPONIBLE) y USER → 403', async () => {
    const pc = await createPc();
    assert.equal(pc.estatus, 'DISPONIBLE');
    assert.equal(pc.numeroInventario, 'UTR-PC-01');
    assert.deepEqual(pc.perifericosIncluidos, ['Monitor', 'Teclado', 'Mouse']);
    assert.equal((await as(api.post('/api/labs/computers'), team.token, alumno.token).send(newPc({ numeroInventario: 'X' }))).status, 403);
  });

  it('filtros por laboratorio y estatus; lista de laboratorios', async () => {
    await createPc();
    await createPc({ numeroInventario: 'UTR-PC-02', laboratorio: 'Redes' });
    const labA = await as(api.get('/api/labs/computers?laboratorio=lab-a&estatus=DISPONIBLE'), team.token, alumno.token);
    assert.deepEqual(labA.body.map((p) => p.numeroInventario), ['UTR-PC-01']);
    const labs = await as(api.get('/api/labs/computers/labs'), team.token, alumno.token);
    assert.deepEqual(labs.body, ['Lab-A', 'Redes']);
  });

  it('ADMIN registra periférico y lo lista', async () => {
    const r = await as(api.post('/api/labs/equipment'), team.token, team.adminToken).send({ tipo: 'Proyector', numeroSerie: 'epx-123', laboratorio: 'Lab-A' });
    assert.equal(r.status, 201);
    assert.deepEqual([r.body.tipo, r.body.estatus, r.body.numeroSerie], ['Proyector', 'DISPONIBLE', 'EPX-123']);
    const dup = await as(api.post('/api/labs/equipment'), team.token, team.adminToken).send({ tipo: 'Proyector', numeroSerie: 'EPX-123', laboratorio: 'Lab-B' });
    assert.equal(dup.status, 409);
    const list = await as(api.get('/api/labs/equipment?laboratorio=Lab-A'), team.token, alumno.token);
    assert.equal(list.body.length, 1);
    const up = await as(api.patch(`/api/labs/equipment/${r.body.id}`), team.token, team.adminToken).send({ estatus: 'MANTENIMIENTO' });
    assert.equal(up.body.equipment.estatus, 'MANTENIMIENTO');
  });
});

describe('Asignaciones', () => {
  it('flujo: asignar → PC OCUPADA → liberar → PC DISPONIBLE', async () => {
    const pc = await createPc();
    const a = await assign(alumno.token, { computerId: pc.id, userId: 999, materia: 'Desarrollo Web', horasUso: 2 });
    assert.equal(a.status, 201, JSON.stringify(a.body));
    assert.equal(a.body.estatus, 'ASIGNADA');
    assert.equal(a.body.pc, 'UTR-PC-01');
    assert.equal(a.body.userId, alumno.user.id);
    assert.ok(a.body.inicio);
    assert.equal(new Date(a.body.finEstimado) - new Date(a.body.inicio), 2 * 3_600_000);
    assert.equal((await getPc(pc.id)).estatus, 'OCUPADA');

    const r = await release(alumno.token, a.body.assignmentId, { reporteFalla: false, descripcionFalla: '' });
    assert.equal(r.status, 200);
    assert.deepEqual([r.body.estatus, r.body.pcEstatus, r.body.liberacionForzada], ['LIBERADA', 'DISPONIBLE', false]);
    assert.equal((await release(alumno.token, a.body.assignmentId)).status, 409);
  });

  it('no se asigna una PC ocupada ni dos PCs al mismo usuario', async () => {
    const pc1 = await createPc();
    const pc2 = await createPc({ numeroInventario: 'UTR-PC-02' });
    const otro = await registerAndLogin(api, team.token, 2);
    await assign(alumno.token, { computerId: pc1.id, materia: 'Redes', horasUso: 1 });
    const ocupada = await assign(otro.token, { computerId: pc1.id, materia: 'Redes', horasUso: 1 });
    assert.equal(ocupada.status, 409);
    assert.equal(ocupada.body.code, 'PC_NOT_AVAILABLE');
    const doble = await assign(alumno.token, { computerId: pc2.id, materia: 'Redes', horasUso: 1 });
    assert.equal(doble.status, 409);
    assert.equal(doble.body.code, 'ALREADY_ASSIGNED');
    assert.equal((await getPc(pc2.id)).estatus, 'DISPONIBLE');
  });

  it('reporte de falla manda la PC a MANTENIMIENTO; ADMIN la regresa a DISPONIBLE', async () => {
    const pc = await createPc();
    const a = await assign(alumno.token, { computerId: pc.id, materia: 'BD', horasUso: 1 });
    assert.equal((await release(alumno.token, a.body.assignmentId, { reporteFalla: true })).status, 400);
    const r = await release(alumno.token, a.body.assignmentId, { reporteFalla: true, descripcionFalla: 'No enciende el monitor' });
    assert.equal(r.body.pcEstatus, 'MANTENIMIENTO');
    const p = await getPc(pc.id);
    assert.deepEqual([p.estatus, p.ultimoReporteFalla], ['MANTENIMIENTO', 'No enciende el monitor']);
    assert.equal((await assign(alumno.token, { computerId: pc.id, materia: 'BD', horasUso: 1 })).status, 409);

    const fix = await as(api.patch(`/api/labs/computers/${pc.id}`), team.token, team.adminToken).send({ estatus: 'DISPONIBLE' });
    assert.equal(fix.status, 200);
    assert.deepEqual([fix.body.computer.estatus, fix.body.computer.ultimoReporteFalla], ['DISPONIBLE', null]);
  });

  it('USER no libera asignaciones ajenas; ADMIN sí (liberación forzada)', async () => {
    const pc = await createPc();
    const otro = await registerAndLogin(api, team.token, 2);
    const a = await assign(alumno.token, { computerId: pc.id, materia: 'IA', horasUso: 3 });
    assert.equal((await release(otro.token, a.body.assignmentId)).status, 403);
    const r = await release(team.adminToken, a.body.assignmentId);
    assert.equal(r.status, 200);
    assert.equal(r.body.liberacionForzada, true);
  });

  it('no se cambia el estatus de una PC ocupada', async () => {
    const pc = await createPc();
    await assign(alumno.token, { computerId: pc.id, materia: 'IA', horasUso: 1 });
    const r = await as(api.patch(`/api/labs/computers/${pc.id}`), team.token, team.adminToken).send({ estatus: 'MANTENIMIENTO' });
    assert.equal(r.status, 409);
    const spec = await as(api.patch(`/api/labs/computers/${pc.id}`), team.token, team.adminToken).send({ especificaciones: 'Core i9' });
    assert.equal(spec.status, 200);
  });

  it('USER ve solo las suyas; ADMIN ve todas (monitor) y filtra por laboratorio', async () => {
    const pc1 = await createPc();
    const pc2 = await createPc({ numeroInventario: 'UTR-PC-02', laboratorio: 'Redes' });
    const otro = await registerAndLogin(api, team.token, 2);
    await assign(alumno.token, { computerId: pc1.id, materia: 'A', horasUso: 1 });
    await assign(otro.token, { computerId: pc2.id, materia: 'B', horasUso: 1 });
    const mine = await as(api.get('/api/labs/assignments?estatus=ASIGNADA'), team.token, alumno.token);
    assert.equal(mine.body.length, 1);
    assert.deepEqual([mine.body[0].usuario, mine.body[0].laboratorio], ['Alumno 1', 'Lab-A']);
    const all = await as(api.get('/api/labs/assignments?estatus=ASIGNADA'), team.token, team.adminToken);
    assert.equal(all.body.length, 2);
    const redes = await as(api.get('/api/labs/assignments?laboratorio=Redes'), team.token, team.adminToken);
    assert.deepEqual(redes.body.map((x) => x.pc), ['UTR-PC-02']);
  });

  it('asignaciones concurrentes de la misma PC: solo una gana', async () => {
    const pc = await createPc();
    const alumnos = await Promise.all([2, 3, 4, 5].map((n) => registerAndLogin(api, team.token, n)));
    const rs = await Promise.all(alumnos.map((a) => assign(a.token, { computerId: pc.id, materia: 'X', horasUso: 1 })));
    assert.equal(rs.filter((r) => r.status === 201).length, 1);
  });

  it('equipo del proyecto A recibe 403 en /api/labs', async () => {
    const teamA = await createTeam(api, 'equipo-a1', ['A']);
    assert.equal((await as(api.get('/api/labs/computers'), teamA.token, teamA.adminToken)).status, 403);
  });
});
