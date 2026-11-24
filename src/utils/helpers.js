import { badRequest } from './httpError.js';

const TZ = 'America/Mexico_City';

/** Convierte :id de la URL a número entero positivo o lanza 400. */
export function parseId(value, name = 'id') {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw badRequest(`El parámetro ${name} debe ser un número entero positivo`);
  return n;
}

/** Fecha como "YYYY-MM-DD" (zona horaria de México). */
export function ymd(date) {
  if (!date) return null;
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date(date));
}

export const todayYmd = () => ymd(new Date());

/** Escapa texto para usarlo dentro de una RegExp (búsquedas). */
export const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Búsqueda "contiene", sin distinguir mayúsculas. */
export const containsRegex = (s) => new RegExp(escapeRegex(s.trim()), 'i');
