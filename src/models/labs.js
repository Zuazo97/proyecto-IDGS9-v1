import { model, Schema } from 'mongoose';
import { tenantSchema } from './Counter.js';

// ---------- Computadoras ----------
export const PC_STATUS = ['DISPONIBLE', 'OCUPADA', 'MANTENIMIENTO'];

const computerSchema = tenantSchema(
  {
    numeroInventario: { type: String, required: true, trim: true, uppercase: true },
    laboratorio: { type: String, required: true, trim: true },
    especificaciones: { type: String, required: true, trim: true },
    perifericosIncluidos: { type: [String], default: [] },
    estatus: { type: String, enum: PC_STATUS, default: 'DISPONIBLE' },
    ultimoReporteFalla: { type: String, default: null },
  },
  'computers',
);
computerSchema.index({ appId: 1, numeroInventario: 1 }, { unique: true });

export const Computer = model('Computer', computerSchema);

export const serializeComputer = (c) => ({
  id: c.id,
  numeroInventario: c.numeroInventario,
  laboratorio: c.laboratorio,
  especificaciones: c.especificaciones,
  perifericosIncluidos: c.perifericosIncluidos,
  estatus: c.estatus,
  ultimoReporteFalla: c.ultimoReporteFalla,
});

// ---------- Equipo periférico (proyectores, switches, cables...) ----------
export const EQUIPMENT_STATUS = ['DISPONIBLE', 'EN_USO', 'MANTENIMIENTO', 'BAJA'];

const equipmentSchema = tenantSchema(
  {
    tipo: { type: String, required: true, trim: true },
    numeroSerie: { type: String, required: true, trim: true, uppercase: true },
    laboratorio: { type: String, required: true, trim: true },
    descripcion: { type: String, default: '', trim: true },
    estatus: { type: String, enum: EQUIPMENT_STATUS, default: 'DISPONIBLE' },
  },
  'equipment',
);
equipmentSchema.index({ appId: 1, numeroSerie: 1 }, { unique: true });

export const Equipment = model('Equipment', equipmentSchema);

export const serializeEquipment = (e) => ({
  id: e.id,
  tipo: e.tipo,
  numeroSerie: e.numeroSerie,
  laboratorio: e.laboratorio,
  descripcion: e.descripcion,
  estatus: e.estatus,
});

// ---------- Asignaciones de PC ----------
export const ASSIGNMENT_STATUS = ['ASIGNADA', 'LIBERADA'];

const assignmentSchema = tenantSchema(
  {
    computer: { type: Schema.Types.ObjectId, ref: 'Computer', required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    materia: { type: String, required: true, trim: true },
    horasUso: { type: Number, required: true, min: 0.5, max: 12 },
    inicio: { type: Date, default: Date.now },
    fin: { type: Date, default: null },
    estatus: { type: String, enum: ASSIGNMENT_STATUS, default: 'ASIGNADA' },
    reporteFalla: { type: Boolean, default: false },
    descripcionFalla: { type: String, default: '' },
    liberacionForzada: { type: Boolean, default: false },
  },
  'labAssignments',
);
// Un usuario solo puede tener una PC asignada a la vez, y una PC solo una asignación activa.
assignmentSchema.index({ user: 1 }, { unique: true, partialFilterExpression: { estatus: 'ASIGNADA' }, name: 'una_asignacion_activa_por_usuario' });
assignmentSchema.index({ computer: 1 }, { unique: true, partialFilterExpression: { estatus: 'ASIGNADA' }, name: 'una_asignacion_activa_por_pc' });

export const LabAssignment = model('LabAssignment', assignmentSchema);

export const serializeAssignment = (a) => ({
  assignmentId: a.id,
  computerId: a.computer?.id ?? null,
  pc: a.computer?.numeroInventario ?? null,
  laboratorio: a.computer?.laboratorio ?? null,
  especificaciones: a.computer?.especificaciones ?? null,
  pcEstatus: a.computer?.estatus ?? null,
  userId: a.user?.id ?? null,
  usuario: a.user?.nombre ?? null,
  matricula: a.user?.matricula ?? null,
  materia: a.materia,
  horasUso: a.horasUso,
  inicio: a.inicio,
  finEstimado: new Date(new Date(a.inicio).getTime() + a.horasUso * 3_600_000),
  fin: a.fin,
  estatus: a.estatus,
  reporteFalla: a.reporteFalla,
  descripcionFalla: a.descripcionFalla,
  liberacionForzada: a.liberacionForzada,
});
