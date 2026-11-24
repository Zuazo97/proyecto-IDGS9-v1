import { z } from 'zod';
import { User } from '../models/User.js';
import { isAdmin } from '../middlewares/auth.js';
import { badRequest, notFound } from '../utils/httpError.js';

/**
 * Usuario para el que se crea un préstamo/asignación.
 * - USER: siempre él mismo (se ignora userId del body).
 * - ADMIN: puede indicar userId de otro usuario de su equipo.
 */
export async function resolveTargetUser(req, userId) {
  if (!isAdmin(req) || userId == null || userId === req.user.id) return req.user;
  const user = await User.findOne({ appId: req.tenant._id, id: userId });
  if (!user) throw notFound('Usuario no encontrado');
  if (!user.activo) throw badRequest('El usuario está desactivado');
  return user;
}

/** Filtro de visibilidad: ADMIN ve todo el equipo, USER solo lo suyo. */
export const ownerFilter = (req) => (isAdmin(req) ? { appId: req.tenant._id } : { appId: req.tenant._id, user: req.user._id });

export const zId = (name) => z.coerce.number(`${name} debe ser numérico`).int().positive(`${name} debe ser un id válido`);
export const zText = (name, max = 200) => z.string(`${name} es obligatorio`).trim().min(1, `${name} es obligatorio`).max(max);
export const zCount = (name) => z.coerce.number(`${name} debe ser numérico`).int(`${name} debe ser entero`).min(0, `${name} no puede ser negativo`);

/** Exige que el body de una actualización traiga al menos un campo. */
export const nonEmpty = (schema) =>
  schema.refine((o) => Object.values(o).some((v) => v !== undefined), 'Envía al menos un campo para actualizar');
