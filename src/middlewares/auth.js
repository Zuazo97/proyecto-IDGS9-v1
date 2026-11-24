import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { unauthorized, forbidden } from '../utils/httpError.js';

export function signUserToken(user, tenant) {
  return jwt.sign(
    { id: user.id, matricula: user.matricula, rol: user.rol, app: tenant.nombre },
    env.jwtSecret,
    { expiresIn: env.jwtExpiresIn, subject: String(user.id) },
  );
}

/**
 * Valida "Authorization: Bearer <jwt>" y carga al usuario en req.user.
 * El rol se toma de la base de datos (no del token) para que un cambio de rol aplique de inmediato.
 */
export async function auth(req, _res, next) {
  const header = req.get('authorization') || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    throw unauthorized('Falta el header Authorization: Bearer <token>', 'TOKEN_MISSING');
  }

  let payload;
  try {
    payload = jwt.verify(token, env.jwtSecret);
  } catch (err) {
    const expired = err.name === 'TokenExpiredError';
    throw unauthorized(
      expired ? 'La sesión expiró, inicia sesión de nuevo' : 'Token inválido',
      expired ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID',
    );
  }

  // Un token de otro equipo no sirve con este x-api-token.
  if (payload.app !== req.tenant.nombre) throw unauthorized('El token no pertenece a esta aplicación', 'TOKEN_INVALID');

  const user = await User.findOne({ appId: req.tenant._id, id: payload.id });
  if (!user) throw unauthorized('El usuario del token ya no existe', 'TOKEN_INVALID');
  if (!user.activo) throw unauthorized('Usuario desactivado', 'USER_INACTIVE');

  req.user = user;
  next();
}

export const requireRole = (...roles) => (req, _res, next) => {
  if (!roles.includes(req.user.rol)) {
    throw forbidden(`Acceso restringido: se requiere rol ${roles.join(' o ')}`);
  }
  next();
};

export const isAdmin = (req) => req.user?.rol === 'ADMIN';
