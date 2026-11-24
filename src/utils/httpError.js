// Error HTTP con formato uniforme: { message, code, errors? }
export class HttpError extends Error {
  constructor(status, message, code, errors) {
    super(message);
    this.status = status;
    this.code = code;
    this.errors = errors;
  }
}

export const badRequest = (message, errors) => new HttpError(400, message, 'BAD_REQUEST', errors);
export const unauthorized = (message, code = 'UNAUTHORIZED') => new HttpError(401, message, code);
export const forbidden = (message, code = 'FORBIDDEN') => new HttpError(403, message, code);
export const notFound = (message = 'Recurso no encontrado') => new HttpError(404, message, 'NOT_FOUND');
export const conflict = (message, code = 'CONFLICT') => new HttpError(409, message, code);
