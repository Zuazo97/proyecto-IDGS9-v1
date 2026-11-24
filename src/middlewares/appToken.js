import { App } from '../models/App.js';
import { unauthorized, forbidden } from '../utils/httpError.js';

// Caché corta para no consultar Mongo en cada petición.
const CACHE_TTL_MS = 60_000;
const cache = new Map();

export function clearAppTokenCache() {
  cache.clear();
}

async function findApp(token) {
  const hit = cache.get(token);
  if (hit && hit.expires > Date.now()) return hit.app;
  const app = await App.findOne({ token }).lean();
  cache.set(token, { app, expires: Date.now() + CACHE_TTL_MS });
  return app;
}

/** Valida el header x-api-token e identifica al equipo (tenant): req.tenant */
export async function appToken(req, _res, next) {
  const token = req.get('x-api-token');
  if (!token) throw unauthorized('Falta el header x-api-token', 'APP_TOKEN_MISSING');
  const app = await findApp(token);
  if (!app || !app.activo) throw unauthorized('x-api-token inválido o desactivado', 'APP_TOKEN_INVALID');
  req.tenant = app;
  next();
}

/** Restringe un módulo a los equipos que tienen asignado ese proyecto (A, B o C). */
export const requireProject = (proyecto) => (req, _res, next) => {
  if (!req.tenant.proyectos.includes(proyecto)) {
    throw forbidden(
      `Tu x-api-token no tiene habilitado el Proyecto ${proyecto}`,
      'PROJECT_NOT_ALLOWED',
    );
  }
  next();
};
