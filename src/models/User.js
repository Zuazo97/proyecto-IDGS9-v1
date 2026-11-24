import { model } from 'mongoose';
import { tenantSchema } from './Counter.js';

export const ROLES = ['USER', 'ADMIN'];

const userSchema = tenantSchema(
  {
    nombre: { type: String, required: true, trim: true },
    matricula: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    password: { type: String, required: true, select: false },
    rol: { type: String, enum: ROLES, default: 'USER' },
    activo: { type: Boolean, default: true },
  },
  'users',
);

// Email y matrícula son únicos dentro de cada equipo (no entre equipos).
userSchema.index({ appId: 1, email: 1 }, { unique: true });
userSchema.index({ appId: 1, matricula: 1 }, { unique: true });

export const User = model('User', userSchema);

export const serializeUser = (u) => ({
  id: u.id,
  nombre: u.nombre,
  matricula: u.matricula,
  email: u.email,
  rol: u.rol,
  activo: u.activo,
  createdAt: u.createdAt,
});
