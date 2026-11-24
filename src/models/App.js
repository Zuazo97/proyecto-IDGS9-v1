import { Schema, model } from 'mongoose';
import crypto from 'node:crypto';

export const PROYECTOS = ['A', 'B', 'C'];
export const PROYECTO_NOMBRE = {
  A: 'Biblioteca Universitaria',
  B: 'Préstamo de Material Deportivo',
  C: 'Laboratorios de Cómputo',
};

// Una "App" es un equipo de alumnos. Su token es el header x-api-token y aísla sus datos.
const appSchema = new Schema(
  {
    nombre: { type: String, required: true, unique: true, trim: true, lowercase: true },
    proyectos: { type: [{ type: String, enum: PROYECTOS }], required: true },
    token: { type: String, required: true, unique: true },
    activo: { type: Boolean, default: true },
  },
  { timestamps: true, versionKey: false },
);

export const generateAppToken = (nombre) =>
  `utr-idgs9-${nombre}-${crypto.randomBytes(12).toString('hex')}`;

export const App = model('App', appSchema);
