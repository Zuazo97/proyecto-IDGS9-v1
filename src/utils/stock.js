import { notFound, conflict } from './httpError.js';

/**
 * Actualiza un documento con inventario (total / disponibles) de forma atómica.
 * Si cambia el total, los disponibles se ajustan por la diferencia conservando lo prestado.
 * Rechaza (409) un total menor a lo que está prestado en ese momento.
 *
 * @param Model       modelo Mongoose
 * @param filter      { appId, id }
 * @param fields      { total: 'stockTotal', avail: 'stockDisponible' }
 * @param newTotal    nuevo total o undefined si no cambia
 * @param set         otros campos a actualizar (texto plano)
 */
export async function updateWithStock(Model, filter, { total, avail }, newTotal, set = {}) {
  const literalSet = Object.fromEntries(Object.entries(set).map(([k, v]) => [k, { $literal: v }]));
  const stage = { ...literalSet };
  const query = { ...filter };

  if (newTotal !== undefined) {
    const lent = { $subtract: [`$${total}`, `$${avail}`] };
    query.$expr = { $gte: [newTotal, lent] };
    stage[avail] = { $subtract: [newTotal, lent] };
    stage[total] = newTotal;
  }

  const doc = await Model.findOneAndUpdate(query, [{ $set: stage }], {
    returnDocument: 'after',
    updatePipeline: true,
  });
  if (doc) return doc;

  const current = await Model.findOne(filter);
  if (!current) throw notFound();
  const prestados = current[total] - current[avail];
  throw conflict(
    `El total no puede ser menor a lo que está prestado actualmente (${prestados})`,
    'STOCK_BELOW_LENT',
  );
}
