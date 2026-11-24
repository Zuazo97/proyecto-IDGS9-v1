import { model, Schema } from 'mongoose';
import { tenantSchema } from './Counter.js';

// ---------- Artículos deportivos ----------
export const ESTADO_FISICO = ['NUEVO', 'BUENO', 'DESGASTADO'];

const sportItemSchema = tenantSchema(
  {
    codigo: { type: String, required: true, trim: true, uppercase: true },
    nombre: { type: String, required: true, trim: true },
    deporte: { type: String, required: true, trim: true },
    estadoFisico: { type: String, enum: ESTADO_FISICO, default: 'NUEVO' },
    cantidadTotal: { type: Number, required: true, min: 0 },
    disponibles: { type: Number, required: true, min: 0 },
  },
  'sportItems',
);
sportItemSchema.index({ appId: 1, codigo: 1 }, { unique: true });

export const SportItem = model('SportItem', sportItemSchema);

export const serializeSportItem = (i) => ({
  id: i.id,
  codigo: i.codigo,
  nombre: i.nombre,
  deporte: i.deporte,
  estadoFisico: i.estadoFisico,
  cantidadTotal: i.cantidadTotal,
  disponibles: i.disponibles,
});

// ---------- Préstamos deportivos ----------
export const SPORT_LOAN_STATUS = ['ACTIVO', 'FINALIZADO'];
export const ESTADO_DEVOLUCION = ['BUENO', 'DANADO'];

const sportLoanSchema = tenantSchema(
  {
    item: { type: Schema.Types.ObjectId, ref: 'SportItem', required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    cantidad: { type: Number, required: true, min: 1 },
    canchaOActividad: { type: String, required: true, trim: true },
    horaSalida: { type: Date, default: Date.now },
    horaDevolucion: { type: Date, default: null },
    estatus: { type: String, enum: SPORT_LOAN_STATUS, default: 'ACTIVO' },
    estadoDevolucion: { type: String, enum: [...ESTADO_DEVOLUCION, null], default: null },
    notas: { type: String, default: '' },
  },
  'sportLoans',
);
sportLoanSchema.index({ appId: 1, user: 1, estatus: 1 });

export const SportLoan = model('SportLoan', sportLoanSchema);

export const serializeSportLoan = (l) => ({
  loanId: l.id,
  itemId: l.item?.id ?? null,
  item: l.item?.nombre ?? null,
  codigo: l.item?.codigo ?? null,
  deporte: l.item?.deporte ?? null,
  cantidad: l.cantidad,
  canchaOActividad: l.canchaOActividad,
  userId: l.user?.id ?? null,
  usuario: l.user?.nombre ?? null,
  matricula: l.user?.matricula ?? null,
  estatus: l.estatus,
  horaSalida: l.horaSalida,
  horaDevolucion: l.horaDevolucion,
  estadoDevolucion: l.estadoDevolucion,
  notas: l.notas,
});
