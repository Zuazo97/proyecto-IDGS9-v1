import { badRequest } from '../utils/httpError.js';

/**
 * Valida req.body o req.query con un esquema zod.
 * El resultado limpio queda en req.valid.body / req.valid.query.
 */
export const validate = (schema, where = 'body') => (req, _res, next) => {
  const result = schema.safeParse(req[where] ?? {});
  if (!result.success) {
    const errors = result.error.issues.map((i) => ({
      campo: i.path.join('.') || where,
      mensaje: i.message,
    }));
    throw badRequest('Datos inválidos', errors);
  }
  req.valid = { ...req.valid, [where]: result.data };
  next();
};
