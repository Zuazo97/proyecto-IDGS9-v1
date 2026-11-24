import { auth } from '../middlewares/auth.js';
import { requireProject } from '../middlewares/appToken.js';
import { booksRouter, bookLoansRouter } from './library/library.routes.js';
import { sportItemsRouter, sportLoansRouter } from './sports/sports.routes.js';
import { computersRouter, equipmentRouter, assignmentsRouter } from './labs/labs.routes.js';

// Registro de módulos por proyecto. Cada módulo exige que el equipo tenga habilitado su proyecto.
export function mountModules(api) {
  // Proyecto A — Biblioteca
  api.use('/books', requireProject('A'), auth, booksRouter);
  api.use('/loans/books', requireProject('A'), auth, bookLoansRouter);

  // Proyecto B — Material deportivo
  api.use('/sports/items', requireProject('B'), auth, sportItemsRouter);
  api.use('/sports/loans', requireProject('B'), auth, sportLoansRouter);

  // Proyecto C — Laboratorios de cómputo
  api.use('/labs/computers', requireProject('C'), auth, computersRouter);
  api.use('/labs/equipment', requireProject('C'), auth, equipmentRouter);
  api.use('/labs/assignments', requireProject('C'), auth, assignmentsRouter);
}
