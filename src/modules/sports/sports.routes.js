import { Router } from 'express';
import { z } from 'zod';
import {
  SportItem, SportLoan, ESTADO_FISICO, ESTADO_DEVOLUCION, SPORT_LOAN_STATUS,
  serializeSportItem, serializeSportLoan,
} from '../../models/sports.js';
import { validate } from '../../middlewares/validate.js';
import { requireRole } from '../../middlewares/auth.js';
import { parseId, containsRegex, escapeRegex } from '../../utils/helpers.js';
import { notFound, conflict } from '../../utils/httpError.js';
import { updateWithStock } from '../../utils/stock.js';
import { resolveTargetUser, ownerFilter, zId, zText, zCount, nonEmpty } from '../shared.js';

const POPULATE = [
  { path: 'item', select: 'id nombre codigo deporte' },
  { path: 'user', select: 'id nombre matricula' },
];

// =====================  /api/sports/items  =====================
export const sportItemsRouter = Router();

const listQuery = z.object({
  deporte: z.string().optional(),
  disponible: z.enum(['true', 'false']).optional(),
  search: z.string().optional(),
});

sportItemsRouter.get('/', validate(listQuery, 'query'), async (req, res) => {
  const { deporte, disponible, search } = req.valid.query;
  const filter = { appId: req.tenant._id };
  if (deporte?.trim()) filter.deporte = new RegExp(`^${escapeRegex(deporte.trim())}$`, 'i');
  if (disponible) filter.disponibles = disponible === 'true' ? { $gt: 0 } : 0;
  if (search?.trim()) {
    const rx = containsRegex(search);
    filter.$or = [{ nombre: rx }, { codigo: rx }];
  }
  const items = await SportItem.find(filter).sort({ deporte: 1, nombre: 1 });
  res.json(items.map(serializeSportItem));
});

// Extra: lista de disciplinas para el filtro
sportItemsRouter.get('/sports', async (req, res) => {
  const list = await SportItem.distinct('deporte', { appId: req.tenant._id });
  res.json(list.sort((a, b) => a.localeCompare(b, 'es')));
});

sportItemsRouter.get('/:id', async (req, res) => {
  const item = await SportItem.findOne({ appId: req.tenant._id, id: parseId(req.params.id) });
  if (!item) throw notFound('Ítem no encontrado');
  res.json(serializeSportItem(item));
});

const itemSchema = z.object({
  codigo: zText('codigo', 30),
  nombre: zText('nombre'),
  deporte: zText('deporte', 60),
  estadoFisico: z.enum(ESTADO_FISICO, `estadoFisico debe ser ${ESTADO_FISICO.join(', ')}`).default('NUEVO'),
  cantidadTotal: zCount('cantidadTotal'),
});

sportItemsRouter.post('/', requireRole('ADMIN'), validate(itemSchema), async (req, res) => {
  const data = req.valid.body;
  const item = await SportItem.create({ ...data, appId: req.tenant._id, disponibles: data.cantidadTotal });
  res.status(201).json(serializeSportItem(item));
});

const updateSchema = nonEmpty(
  itemSchema.extend({ estadoFisico: z.enum(ESTADO_FISICO, `estadoFisico debe ser ${ESTADO_FISICO.join(', ')}`) }).partial(),
);

sportItemsRouter.patch('/:id', requireRole('ADMIN'), validate(updateSchema), async (req, res) => {
  const { cantidadTotal, ...rest } = req.valid.body;
  const set = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined));
  if (set.codigo) set.codigo = set.codigo.toUpperCase();
  const item = await updateWithStock(
    SportItem,
    { appId: req.tenant._id, id: parseId(req.params.id) },
    { total: 'cantidadTotal', avail: 'disponibles' },
    cantidadTotal,
    set,
  );
  res.json({ message: 'Ítem actualizado', item: serializeSportItem(item) });
});

// =====================  /api/sports/loans  =====================
export const sportLoansRouter = Router();

const createLoanSchema = z.object({
  itemId: zId('itemId'),
  userId: zId('userId').optional(),
  cantidad: z.coerce.number('cantidad debe ser numérica').int('cantidad debe ser entera').min(1, 'cantidad debe ser al menos 1'),
  canchaOActividad: zText('canchaOActividad'),
});

sportLoansRouter.post('/', validate(createLoanSchema), async (req, res) => {
  const { itemId, userId, cantidad, canchaOActividad } = req.valid.body;
  const user = await resolveTargetUser(req, userId);

  const item = await SportItem.findOne({ appId: req.tenant._id, id: itemId });
  if (!item) throw notFound('Ítem no encontrado');

  const updated = await SportItem.findOneAndUpdate(
    { _id: item._id, disponibles: { $gte: cantidad } },
    { $inc: { disponibles: -cantidad } },
  );
  if (!updated) {
    const actual = await SportItem.findById(item._id);
    throw conflict(`Solo hay ${actual.disponibles} disponibles de "${item.nombre}"`, 'OUT_OF_STOCK');
  }

  try {
    const loan = await SportLoan.create({ appId: req.tenant._id, item: item._id, user: user._id, cantidad, canchaOActividad });
    await loan.populate(POPULATE);
    res.status(201).json(serializeSportLoan(loan));
  } catch (err) {
    await SportItem.updateOne({ _id: item._id }, { $inc: { disponibles: cantidad } });
    throw err;
  }
});

sportLoansRouter.get('/', validate(z.object({ estatus: z.enum(SPORT_LOAN_STATUS).optional() }), 'query'), async (req, res) => {
  const filter = ownerFilter(req);
  if (req.valid.query.estatus) filter.estatus = req.valid.query.estatus;
  const loans = await SportLoan.find(filter).sort({ id: -1 }).populate(POPULATE);
  res.json(loans.map(serializeSportLoan));
});

const returnSchema = z.object({
  // Acepta "DAÑADO" (como aparece en la pantalla B4) y lo normaliza a "DANADO".
  estadoDevolucion: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim().toUpperCase().replace('Ñ', 'N') : v),
    z.enum(ESTADO_DEVOLUCION, 'estadoDevolucion debe ser "BUENO" o "DANADO"'),
  ),
  notas: z.string().trim().max(500).optional().default(''),
});

sportLoansRouter.patch('/:id/return', requireRole('ADMIN'), validate(returnSchema), async (req, res) => {
  const { estadoDevolucion, notas } = req.valid.body;
  const filter = { appId: req.tenant._id, id: parseId(req.params.id) };
  const loan = await SportLoan.findOneAndUpdate(
    { ...filter, estatus: 'ACTIVO' },
    { estatus: 'FINALIZADO', horaDevolucion: new Date(), estadoDevolucion, notas },
    { returnDocument: 'after' },
  );
  if (!loan) {
    if (await SportLoan.exists(filter)) throw conflict('Este préstamo ya fue finalizado', 'ALREADY_RETURNED');
    throw notFound('Préstamo no encontrado');
  }

  // BUENO: el material vuelve a estar disponible. DANADO: se da de baja del inventario.
  const inc = estadoDevolucion === 'BUENO' ? { disponibles: loan.cantidad } : { cantidadTotal: -loan.cantidad };
  await SportItem.updateOne({ _id: loan.item }, { $inc: inc });

  await loan.populate(POPULATE);
  res.json(serializeSportLoan(loan));
});
