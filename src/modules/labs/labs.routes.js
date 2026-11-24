import { Router } from 'express';
import { z } from 'zod';
import {
  Computer, Equipment, LabAssignment, PC_STATUS, EQUIPMENT_STATUS, ASSIGNMENT_STATUS,
  serializeComputer, serializeEquipment, serializeAssignment,
} from '../../models/labs.js';
import { validate } from '../../middlewares/validate.js';
import { requireRole, isAdmin } from '../../middlewares/auth.js';
import { parseId, containsRegex, escapeRegex } from '../../utils/helpers.js';
import { notFound, conflict, forbidden } from '../../utils/httpError.js';
import { resolveTargetUser, ownerFilter, zId, zText, nonEmpty } from '../shared.js';

const exact = (s) => new RegExp(`^${escapeRegex(s.trim())}$`, 'i');
const POPULATE = [
  { path: 'computer', select: 'id numeroInventario laboratorio especificaciones estatus' },
  { path: 'user', select: 'id nombre matricula' },
];

// =====================  /api/labs/computers  =====================
export const computersRouter = Router();

const listPcQuery = z.object({
  laboratorio: z.string().optional(),
  estatus: z.enum(PC_STATUS).optional(),
  search: z.string().optional(),
});

computersRouter.get('/', validate(listPcQuery, 'query'), async (req, res) => {
  const { laboratorio, estatus, search } = req.valid.query;
  const filter = { appId: req.tenant._id };
  if (laboratorio?.trim()) filter.laboratorio = exact(laboratorio);
  if (estatus) filter.estatus = estatus;
  if (search?.trim()) {
    const rx = containsRegex(search);
    filter.$or = [{ numeroInventario: rx }, { especificaciones: rx }];
  }
  const pcs = await Computer.find(filter).sort({ laboratorio: 1, numeroInventario: 1 });
  res.json(pcs.map(serializeComputer));
});

// Extra: lista de laboratorios para el selector
computersRouter.get('/labs', async (req, res) => {
  const [pcs, eq] = await Promise.all([
    Computer.distinct('laboratorio', { appId: req.tenant._id }),
    Equipment.distinct('laboratorio', { appId: req.tenant._id }),
  ]);
  res.json([...new Set([...pcs, ...eq])].sort((a, b) => a.localeCompare(b, 'es')));
});

computersRouter.get('/:id', async (req, res) => {
  const pc = await Computer.findOne({ appId: req.tenant._id, id: parseId(req.params.id) });
  if (!pc) throw notFound('Computadora no encontrada');
  res.json(serializeComputer(pc));
});

const pcSchema = z.object({
  numeroInventario: zText('numeroInventario', 40),
  laboratorio: zText('laboratorio', 60),
  especificaciones: zText('especificaciones', 300),
  perifericosIncluidos: z.array(z.string().trim().min(1).max(60), 'perifericosIncluidos debe ser un arreglo de textos').max(20).default([]),
});

computersRouter.post('/', requireRole('ADMIN'), validate(pcSchema), async (req, res) => {
  const pc = await Computer.create({ ...req.valid.body, appId: req.tenant._id });
  res.status(201).json(serializeComputer(pc));
});

// Extra: editar PC o cambiar estatus DISPONIBLE <-> MANTENIMIENTO (p. ej. tras reparar una falla)
const updatePcSchema = nonEmpty(
  pcSchema
    .extend({
      perifericosIncluidos: pcSchema.shape.perifericosIncluidos.removeDefault(),
      estatus: z.enum(['DISPONIBLE', 'MANTENIMIENTO'], 'estatus solo puede cambiarse a DISPONIBLE o MANTENIMIENTO'),
    })
    .partial(),
);

computersRouter.patch('/:id', requireRole('ADMIN'), validate(updatePcSchema), async (req, res) => {
  const filter = { appId: req.tenant._id, id: parseId(req.params.id) };
  const pc = await Computer.findOne(filter);
  if (!pc) throw notFound('Computadora no encontrada');
  const changes = Object.fromEntries(Object.entries(req.valid.body).filter(([, v]) => v !== undefined));
  if (changes.estatus && pc.estatus === 'OCUPADA') {
    throw conflict('La PC está ocupada; libera la asignación antes de cambiar su estatus', 'PC_OCCUPIED');
  }
  if (changes.estatus === 'DISPONIBLE') changes.ultimoReporteFalla = null;
  // Condición sobre el estatus leído para evitar pisar una asignación hecha al mismo tiempo
  const updated = await Computer.findOneAndUpdate({ ...filter, estatus: pc.estatus }, changes, { returnDocument: 'after', runValidators: true });
  if (!updated) throw conflict('La PC cambió de estatus mientras se actualizaba, intenta de nuevo', 'PC_OCCUPIED');
  res.json({ message: 'Computadora actualizada', computer: serializeComputer(updated) });
});

// =====================  /api/labs/equipment  =====================
export const equipmentRouter = Router();

const listEqQuery = z.object({
  laboratorio: z.string().optional(),
  tipo: z.string().optional(),
  estatus: z.enum(EQUIPMENT_STATUS).optional(),
});

// Extra: listar periféricos
equipmentRouter.get('/', validate(listEqQuery, 'query'), async (req, res) => {
  const { laboratorio, tipo, estatus } = req.valid.query;
  const filter = { appId: req.tenant._id };
  if (laboratorio?.trim()) filter.laboratorio = exact(laboratorio);
  if (tipo?.trim()) filter.tipo = exact(tipo);
  if (estatus) filter.estatus = estatus;
  const list = await Equipment.find(filter).sort({ laboratorio: 1, tipo: 1 });
  res.json(list.map(serializeEquipment));
});

const eqSchema = z.object({
  tipo: zText('tipo', 60),
  numeroSerie: zText('numeroSerie', 60),
  laboratorio: zText('laboratorio', 60),
  descripcion: z.string().trim().max(300).optional(),
});

equipmentRouter.post('/', requireRole('ADMIN'), validate(eqSchema), async (req, res) => {
  const eq = await Equipment.create({ ...req.valid.body, appId: req.tenant._id });
  res.status(201).json(serializeEquipment(eq));
});

// Extra: editar periférico / cambiar estatus
equipmentRouter.patch(
  '/:id',
  requireRole('ADMIN'),
  validate(nonEmpty(eqSchema.extend({ estatus: z.enum(EQUIPMENT_STATUS) }).partial())),
  async (req, res) => {
    const changes = Object.fromEntries(Object.entries(req.valid.body).filter(([, v]) => v !== undefined));
    const eq = await Equipment.findOneAndUpdate({ appId: req.tenant._id, id: parseId(req.params.id) }, changes, {
      returnDocument: 'after',
      runValidators: true,
    });
    if (!eq) throw notFound('Equipo no encontrado');
    res.json({ message: 'Equipo actualizado', equipment: serializeEquipment(eq) });
  },
);

// =====================  /api/labs/assignments  =====================
export const assignmentsRouter = Router();

const createAssignmentSchema = z.object({
  computerId: zId('computerId'),
  userId: zId('userId').optional(),
  materia: zText('materia', 100),
  horasUso: z.coerce.number('horasUso debe ser numérico').min(0.5, 'horasUso mínimo 0.5').max(12, 'horasUso máximo 12'),
});

assignmentsRouter.post('/', validate(createAssignmentSchema), async (req, res) => {
  const { computerId, userId, materia, horasUso } = req.valid.body;
  const user = await resolveTargetUser(req, userId);

  if (await LabAssignment.exists({ user: user._id, estatus: 'ASIGNADA' })) {
    throw conflict('El usuario ya tiene un equipo asignado; libéralo primero', 'ALREADY_ASSIGNED');
  }

  const pc = await Computer.findOne({ appId: req.tenant._id, id: computerId });
  if (!pc) throw notFound('Computadora no encontrada');

  const taken = await Computer.findOneAndUpdate(
    { _id: pc._id, estatus: 'DISPONIBLE' },
    { estatus: 'OCUPADA' },
  );
  if (!taken) throw conflict(`La computadora no está disponible (estatus: ${pc.estatus})`, 'PC_NOT_AVAILABLE');

  try {
    const a = await LabAssignment.create({ appId: req.tenant._id, computer: pc._id, user: user._id, materia, horasUso });
    await a.populate(POPULATE);
    res.status(201).json(serializeAssignment(a));
  } catch (err) {
    await Computer.updateOne({ _id: pc._id, estatus: 'OCUPADA' }, { estatus: 'DISPONIBLE' });
    if (err.code === 11000) throw conflict('El usuario ya tiene un equipo asignado; libéralo primero', 'ALREADY_ASSIGNED');
    throw err;
  }
});

const listAssignmentsQuery = z.object({
  estatus: z.enum(ASSIGNMENT_STATUS).optional(),
  laboratorio: z.string().optional(),
});

assignmentsRouter.get('/', validate(listAssignmentsQuery, 'query'), async (req, res) => {
  const { estatus, laboratorio } = req.valid.query;
  const filter = ownerFilter(req);
  if (estatus) filter.estatus = estatus;
  if (laboratorio?.trim()) {
    const pcs = await Computer.find({ appId: req.tenant._id, laboratorio: exact(laboratorio) }, '_id');
    filter.computer = { $in: pcs.map((p) => p._id) };
  }
  const list = await LabAssignment.find(filter).sort({ id: -1 }).populate(POPULATE);
  res.json(list.map(serializeAssignment));
});

const releaseSchema = z
  .object({
    reporteFalla: z.boolean('reporteFalla debe ser true o false').default(false),
    descripcionFalla: z.string().trim().max(500).optional().default(''),
  })
  .refine((b) => !b.reporteFalla || b.descripcionFalla.length >= 5, {
    message: 'Describe la falla (mínimo 5 caracteres) cuando reporteFalla es true',
    path: ['descripcionFalla'],
  });

assignmentsRouter.patch('/:id/release', validate(releaseSchema), async (req, res) => {
  const { reporteFalla, descripcionFalla } = req.valid.body;
  const filter = { appId: req.tenant._id, id: parseId(req.params.id) };

  const current = await LabAssignment.findOne(filter);
  if (!current) throw notFound('Asignación no encontrada');
  const owner = current.user.equals(req.user._id);
  if (!owner && !isAdmin(req)) throw forbidden('Solo puedes liberar tus propias asignaciones');

  const a = await LabAssignment.findOneAndUpdate(
    { ...filter, estatus: 'ASIGNADA' },
    {
      estatus: 'LIBERADA',
      fin: new Date(),
      reporteFalla,
      descripcionFalla: reporteFalla ? descripcionFalla : '',
      liberacionForzada: !owner,
    },
    { returnDocument: 'after' },
  );
  if (!a) throw conflict('Esta asignación ya fue liberada', 'ALREADY_RELEASED');

  await Computer.updateOne(
    { _id: a.computer },
    reporteFalla
      ? { estatus: 'MANTENIMIENTO', ultimoReporteFalla: descripcionFalla }
      : { estatus: 'DISPONIBLE' },
  );

  await a.populate(POPULATE);
  res.json(serializeAssignment(a));
});
