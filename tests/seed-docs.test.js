import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { setup, teardown, resetDb, as, login } from './helpers.js';
import { provisionTeam } from '../scripts/lib/provision.js';

let api;

before(async () => {
  api = await setup();
});
after(teardown);
beforeEach(resetDb);

describe('Provisionamiento de equipos (seed)', () => {
  it('crea token, ADMIN, alumno demo y datos; las credenciales funcionan', async () => {
    const r = await provisionTeam({ nombre: 'equipo-a1', proyectos: ['A'] });
    assert.equal(r.created, true);
    assert.match(r.token, /^utr-idgs9-equipo-a1-[0-9a-f]{24}$/);
    assert.deepEqual(r.datos, { libros: 15 });

    const admin = r.credenciales.find((c) => c.rol === 'ADMIN');
    const tok = await login(api, r.token, admin.email, admin.password);
    const books = await as(api.get('/api/books'), r.token, tok);
    assert.equal(books.body.length, 15);
    assert.deepEqual(books.body.map((b) => b.id).sort((a, b) => a - b).slice(0, 3), [1, 2, 3]);
  });

  it('es idempotente: no cambia token ni duplica datos', async () => {
    const first = await provisionTeam({ nombre: 'equipo-c1', proyectos: ['C'] });
    assert.deepEqual(first.datos, { computadoras: 24, perifericos: 6 });
    const second = await provisionTeam({ nombre: 'equipo-c1', proyectos: ['C'] });
    assert.equal(second.created, false);
    assert.equal(second.token, first.token);
    assert.deepEqual(second.datos, {});
  });

  it('rechaza nombres o proyectos inválidos', async () => {
    await assert.rejects(provisionTeam({ nombre: 'Equipo A!', proyectos: ['A'] }), /inválido/);
    await assert.rejects(provisionTeam({ nombre: 'equipo-x', proyectos: ['Z'] }), /inválidos/);
  });
});

describe('Documentación', () => {
  it('sirve /api/docs.json y /api/docs sin tokens', async () => {
    const spec = await api.get('/api/docs.json');
    assert.equal(spec.status, 200);
    assert.equal(spec.body.openapi, '3.0.3');
    assert.ok(Object.keys(spec.body.paths).length >= 20);
    const ui = await api.get('/api/docs/');
    assert.equal(ui.status, 200);
    assert.match(ui.text, /swagger/i);
  });

  it('cada ruta documentada existe en la API (no responde "Ruta no encontrada")', async () => {
    const team = await provisionTeam({ nombre: 'docente', proyectos: ['A', 'B', 'C'], withSampleData: false });
    const spec = (await api.get('/api/docs.json')).body;
    for (const [path, ops] of Object.entries(spec.paths)) {
      for (const method of Object.keys(ops)) {
        const url = path.replace('{id}', '1');
        const r = await as(api[method](url), team.token).send({});
        assert.notEqual(r.body.code === 'NOT_FOUND' && /Ruta no encontrada/.test(r.body.message), true, `${method.toUpperCase()} ${path}`);
      }
    }
  });
});
