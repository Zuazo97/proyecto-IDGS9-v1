import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resetDb, createTeam, registerAndLogin, as } from './helpers.js';
import { todayYmd } from '../src/utils/helpers.js';

let api;
let team;
let alumno;

const futuro = () => {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
};

const newBook = (over = {}) => ({ isbn: '978-0132350884', titulo: 'Clean Code', autor: 'R. Martin', categoria: 'Software', stockTotal: 2, ...over });

before(async () => {
  api = await setup();
});
after(teardown);
beforeEach(async () => {
  await resetDb();
  team = await createTeam(api, 'equipo-a1', ['A']);
  alumno = await registerAndLogin(api, team.token);
});

const createBook = async (over) => {
  const r = await as(api.post('/api/books'), team.token, team.adminToken).send(newBook(over));
  assert.equal(r.status, 201, JSON.stringify(r.body));
  return r.body;
};

describe('Libros', () => {
  it('ADMIN crea libro con stockDisponible = stockTotal', async () => {
    const b = await createBook();
    assert.equal(typeof b.id, 'number');
    assert.equal(b.stockDisponible, 2);
  });

  it('USER no puede crear libros → 403', async () => {
    const r = await as(api.post('/api/books'), team.token, alumno.token).send(newBook());
    assert.equal(r.status, 403);
  });

  it('sin Bearer → 401', async () => {
    assert.equal((await as(api.get('/api/books'), team.token)).status, 401);
  });

  it('ISBN duplicado → 409', async () => {
    await createBook();
    const r = await as(api.post('/api/books'), team.token, team.adminToken).send(newBook());
    assert.equal(r.status, 409);
  });

  it('GET con search y categoria', async () => {
    await createBook();
    await createBook({ isbn: '978-1', titulo: 'Cien años de soledad', autor: 'García Márquez', categoria: 'Literatura' });
    const bySearch = await as(api.get('/api/books?search=márquez'), team.token, alumno.token);
    assert.deepEqual(bySearch.body.map((b) => b.titulo), ['Cien años de soledad']);
    const byCat = await as(api.get('/api/books?categoria=software'), team.token, alumno.token);
    assert.deepEqual(byCat.body.map((b) => b.titulo), ['Clean Code']);
    const cats = await as(api.get('/api/books/categories'), team.token, alumno.token);
    assert.deepEqual(cats.body, ['Literatura', 'Software']);
  });

  it('PUT ajusta stockDisponible por la diferencia y no baja de lo prestado', async () => {
    const b = await createBook({ stockTotal: 3 });
    await as(api.post('/api/loans/books'), team.token, alumno.token).send({ bookId: b.id, fechaDevolucionEstimada: futuro() });
    const up = await as(api.put(`/api/books/${b.id}`), team.token, team.adminToken).send({ titulo: '$Clean Code 2', stockTotal: 6 });
    assert.equal(up.status, 200);
    assert.equal(up.body.message, 'Libro actualizado');
    assert.equal(up.body.book.titulo, '$Clean Code 2');
    assert.deepEqual([up.body.book.stockTotal, up.body.book.stockDisponible], [6, 5]);
    const bad = await as(api.put(`/api/books/${b.id}`), team.token, team.adminToken).send({ stockTotal: 0 });
    assert.equal(bad.status, 409);
    assert.equal((await as(api.put('/api/books/9999'), team.token, team.adminToken).send({ titulo: 'x' })).status, 404);
    assert.equal((await as(api.put(`/api/books/${b.id}`), team.token, team.adminToken).send({})).status, 400);
  });
});

describe('Préstamos de libros', () => {
  it('flujo completo: prestar → stock baja → devolver → stock sube', async () => {
    const b = await createBook({ stockTotal: 1 });
    const loan = await as(api.post('/api/loans/books'), team.token, alumno.token).send({
      bookId: b.id, userId: 999, fechaDevolucionEstimada: futuro(),
    });
    assert.equal(loan.status, 201, JSON.stringify(loan.body));
    assert.equal(loan.body.estatus, 'PRESTADO');
    assert.equal(loan.body.fechaPrestamo, todayYmd());
    assert.equal(loan.body.userId, alumno.user.id, 'USER no puede prestar a nombre de otro');

    const sinStock = await as(api.post('/api/loans/books'), team.token, team.adminToken).send({ bookId: b.id, fechaDevolucionEstimada: futuro() });
    assert.equal(sinStock.status, 409);
    assert.equal(sinStock.body.code, 'OUT_OF_STOCK');

    const forbidden = await as(api.patch(`/api/loans/books/${loan.body.loanId}/return`), team.token, alumno.token).send({});
    assert.equal(forbidden.status, 403);

    const ret = await as(api.patch(`/api/loans/books/${loan.body.loanId}/return`), team.token, team.adminToken).send({ observaciones: 'Entregado en buen estado' });
    assert.equal(ret.status, 200);
    assert.equal(ret.body.estatus, 'DEVUELTO');
    assert.equal(ret.body.fechaDevolucionReal, todayYmd());
    assert.equal(ret.body.observaciones, 'Entregado en buen estado');

    const again = await as(api.patch(`/api/loans/books/${loan.body.loanId}/return`), team.token, team.adminToken).send({});
    assert.equal(again.status, 409);

    const book = await as(api.get(`/api/books/${b.id}`), team.token, alumno.token);
    assert.equal(book.body.stockDisponible, 1);
  });

  it('USER ve solo sus préstamos; ADMIN ve todos', async () => {
    const b = await createBook({ stockTotal: 5 });
    const otro = await registerAndLogin(api, team.token, 2);
    await as(api.post('/api/loans/books'), team.token, alumno.token).send({ bookId: b.id, fechaDevolucionEstimada: futuro() });
    await as(api.post('/api/loans/books'), team.token, otro.token).send({ bookId: b.id, fechaDevolucionEstimada: futuro() });
    const mine = await as(api.get('/api/loans/books'), team.token, alumno.token);
    assert.equal(mine.body.length, 1);
    assert.equal(mine.body[0].usuario, 'Alumno 1');
    assert.equal(mine.body[0].libro, 'Clean Code');
    const all = await as(api.get('/api/loans/books?estatus=PRESTADO'), team.token, team.adminToken);
    assert.equal(all.body.length, 2);
  });

  it('ADMIN puede prestar a nombre de otro usuario', async () => {
    const b = await createBook();
    const r = await as(api.post('/api/loans/books'), team.token, team.adminToken).send({ bookId: b.id, userId: alumno.user.id, fechaDevolucionEstimada: futuro() });
    assert.equal(r.status, 201);
    assert.equal(r.body.usuario, 'Alumno 1');
  });

  it('valida fecha y libro repetido', async () => {
    const b = await createBook();
    const past = await as(api.post('/api/loans/books'), team.token, alumno.token).send({ bookId: b.id, fechaDevolucionEstimada: '2020-01-01' });
    assert.equal(past.status, 400);
    const bad = await as(api.post('/api/loans/books'), team.token, alumno.token).send({ bookId: b.id, fechaDevolucionEstimada: '25/11/2026' });
    assert.equal(bad.status, 400);
    await as(api.post('/api/loans/books'), team.token, alumno.token).send({ bookId: b.id, fechaDevolucionEstimada: futuro() });
    const dup = await as(api.post('/api/loans/books'), team.token, alumno.token).send({ bookId: b.id, fechaDevolucionEstimada: futuro() });
    assert.equal(dup.status, 409);
  });

  it('préstamos concurrentes nunca dejan stock negativo', async () => {
    const b = await createBook({ stockTotal: 2 });
    const alumnos = await Promise.all([2, 3, 4, 5, 6].map((n) => registerAndLogin(api, team.token, n)));
    const results = await Promise.all(
      alumnos.map((a) => as(api.post('/api/loans/books'), team.token, a.token).send({ bookId: b.id, fechaDevolucionEstimada: futuro() })),
    );
    assert.equal(results.filter((r) => r.status === 201).length, 2);
    const book = await as(api.get(`/api/books/${b.id}`), team.token, team.adminToken);
    assert.equal(book.body.stockDisponible, 0);
  });
});

describe('Restricción por proyecto', () => {
  it('un equipo del proyecto B recibe 403 en /api/books', async () => {
    const teamB = await createTeam(api, 'equipo-b1', ['B']);
    const r = await as(api.get('/api/books'), teamB.token, teamB.adminToken);
    assert.equal(r.status, 403);
    assert.equal(r.body.code, 'PROJECT_NOT_ALLOWED');
  });
});
