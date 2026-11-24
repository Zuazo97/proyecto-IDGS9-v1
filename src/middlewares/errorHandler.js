import { HttpError } from '../utils/httpError.js';

export function notFoundHandler(req, res) {
  res.status(404).json({ message: `Ruta no encontrada: ${req.method} ${req.originalUrl}`, code: 'NOT_FOUND' });
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ message: err.message, code: err.code, ...(err.errors && { errors: err.errors }) });
  }

  // JSON mal formado en el body
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'El body no es un JSON válido', code: 'BAD_JSON' });
  }

  // Índice único duplicado (email, matrícula, ISBN, código...)
  if (err.code === 11000) {
    const campo = Object.keys(err.keyPattern || {}).find((k) => k !== 'appId') || 'campo';
    return res.status(409).json({ message: `Ya existe un registro con ese ${campo}`, code: 'DUPLICATE', campo });
  }

  if (err.name === 'ValidationError' || err.name === 'CastError') {
    return res.status(400).json({ message: err.message, code: 'BAD_REQUEST' });
  }

  console.error(err);
  return res.status(500).json({ message: 'Error interno del servidor', code: 'INTERNAL_ERROR' });
}
