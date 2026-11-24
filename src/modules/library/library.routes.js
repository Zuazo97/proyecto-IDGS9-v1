import { Router } from 'express';
import { z } from 'zod';
import { Book, BookLoan, BOOK_LOAN_STATUS, serializeBook, serializeBookLoan } from '../../models/library.js';
import { validate } from '../../middlewares/validate.js';
import { requireRole } from '../../middlewares/auth.js';
import { parseId, containsRegex, escapeRegex, todayYmd } from '../../utils/helpers.js';
import { notFound, conflict } from '../../utils/httpError.js';
import { updateWithStock } from '../../utils/stock.js';
import { resolveTargetUser, ownerFilter, zId, zText, zCount, nonEmpty } from '../shared.js';

// =====================  /api/books  =====================
export const booksRouter = Router();

const listBooksQuery = z.object({
  search: z.string().optional(),
  categoria: z.string().optional(),
  disponible: z.enum(['true', 'false']).optional(),
});

booksRouter.get('/', validate(listBooksQuery, 'query'), async (req, res) => {
  const { search, categoria, disponible } = req.valid.query;
  const filter = { appId: req.tenant._id };
  if (search?.trim()) {
    const rx = containsRegex(search);
    filter.$or = [{ titulo: rx }, { autor: rx }, { isbn: rx }];
  }
  if (categoria?.trim()) filter.categoria = new RegExp(`^${escapeRegex(categoria.trim())}$`, 'i');
  if (disponible) filter.stockDisponible = disponible === 'true' ? { $gt: 0 } : 0;
  const books = await Book.find(filter).sort({ titulo: 1 });
  res.json(books.map(serializeBook));
});

// Extra: lista de categorías para el filtro (select / chips)
booksRouter.get('/categories', async (req, res) => {
  const cats = await Book.distinct('categoria', { appId: req.tenant._id });
  res.json(cats.sort((a, b) => a.localeCompare(b, 'es')));
});

booksRouter.get('/:id', async (req, res) => {
  const book = await Book.findOne({ appId: req.tenant._id, id: parseId(req.params.id) });
  if (!book) throw notFound('Libro no encontrado');
  res.json(serializeBook(book));
});

const createBookSchema = z.object({
  isbn: zText('isbn', 30),
  titulo: zText('titulo'),
  autor: zText('autor'),
  categoria: zText('categoria', 60),
  stockTotal: zCount('stockTotal'),
});

booksRouter.post('/', requireRole('ADMIN'), validate(createBookSchema), async (req, res) => {
  const data = req.valid.body;
  const book = await Book.create({ ...data, appId: req.tenant._id, stockDisponible: data.stockTotal });
  res.status(201).json(serializeBook(book));
});

const updateBookSchema = nonEmpty(createBookSchema.partial());

booksRouter.put('/:id', requireRole('ADMIN'), validate(updateBookSchema), async (req, res) => {
  const { stockTotal, ...rest } = req.valid.body;
  const set = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined));
  const book = await updateWithStock(
    Book,
    { appId: req.tenant._id, id: parseId(req.params.id) },
    { total: 'stockTotal', avail: 'stockDisponible' },
    stockTotal,
    set,
  );
  res.json({ message: 'Libro actualizado', book: serializeBook(book) });
});

// =====================  /api/loans/books  =====================
export const bookLoansRouter = Router();

const populateLoan = (q) => q.populate('book', 'id titulo isbn autor').populate('user', 'id nombre matricula');

const createLoanSchema = z.object({
  bookId: zId('bookId'),
  userId: zId('userId').optional(),
  fechaDevolucionEstimada: z
    .string('fechaDevolucionEstimada es obligatoria')
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'fechaDevolucionEstimada debe tener formato YYYY-MM-DD')
    .refine((s) => !Number.isNaN(Date.parse(s)), 'fechaDevolucionEstimada no es una fecha válida')
    .refine((s) => s >= todayYmd(), 'fechaDevolucionEstimada no puede ser anterior a hoy'),
});

bookLoansRouter.post('/', validate(createLoanSchema), async (req, res) => {
  const { bookId, userId, fechaDevolucionEstimada } = req.valid.body;
  const user = await resolveTargetUser(req, userId);

  const book = await Book.findOne({ appId: req.tenant._id, id: bookId });
  if (!book) throw notFound('Libro no encontrado');

  const yaPrestado = await BookLoan.exists({ appId: req.tenant._id, book: book._id, user: user._id, estatus: 'PRESTADO' });
  if (yaPrestado) throw conflict('El usuario ya tiene este libro prestado', 'ALREADY_BORROWED');

  // Descuento atómico: solo si hay stock
  const updated = await Book.findOneAndUpdate(
    { _id: book._id, stockDisponible: { $gt: 0 } },
    { $inc: { stockDisponible: -1 } },
  );
  if (!updated) throw conflict('No hay ejemplares disponibles de este libro', 'OUT_OF_STOCK');

  try {
    const loan = await BookLoan.create({ appId: req.tenant._id, book: book._id, user: user._id, fechaDevolucionEstimada });
    await loan.populate([{ path: 'book', select: 'id titulo isbn autor' }, { path: 'user', select: 'id nombre matricula' }]);
    res.status(201).json(serializeBookLoan(loan));
  } catch (err) {
    await Book.updateOne({ _id: book._id }, { $inc: { stockDisponible: 1 } });
    throw err;
  }
});

bookLoansRouter.get('/', validate(z.object({ estatus: z.enum(BOOK_LOAN_STATUS).optional() }), 'query'), async (req, res) => {
  const filter = ownerFilter(req);
  if (req.valid.query.estatus) filter.estatus = req.valid.query.estatus;
  const loans = await populateLoan(BookLoan.find(filter).sort({ id: -1 }));
  res.json(loans.map(serializeBookLoan));
});

bookLoansRouter.patch(
  '/:id/return',
  requireRole('ADMIN'),
  validate(z.object({ observaciones: z.string().trim().max(500).optional().default('') })),
  async (req, res) => {
    const filter = { appId: req.tenant._id, id: parseId(req.params.id) };
    const loan = await BookLoan.findOneAndUpdate(
      { ...filter, estatus: 'PRESTADO' },
      { estatus: 'DEVUELTO', fechaDevolucionReal: new Date(), observaciones: req.valid.body.observaciones },
      { returnDocument: 'after' },
    );
    if (!loan) {
      if (await BookLoan.exists(filter)) throw conflict('Este préstamo ya fue devuelto', 'ALREADY_RETURNED');
      throw notFound('Préstamo no encontrado');
    }
    await Book.updateOne({ _id: loan.book }, { $inc: { stockDisponible: 1 } });
    await loan.populate([{ path: 'book', select: 'id titulo isbn autor' }, { path: 'user', select: 'id nombre matricula' }]);
    res.json(serializeBookLoan(loan));
  },
);
