import { auth } from '../middlewares/auth.js';
import { requireProject } from '../middlewares/appToken.js';
import { booksRouter, bookLoansRouter } from './library/library.routes.js';

// Registro de módulos por proyecto. Cada módulo exige que el equipo tenga habilitado su proyecto.
export function mountModules(api) {
  // Proyecto A — Biblioteca
  api.use('/books', requireProject('A'), auth, booksRouter);
  api.use('/loans/books', requireProject('A'), auth, bookLoansRouter);
}
