import { model, Schema } from 'mongoose';
import { tenantSchema } from './Counter.js';
import { ymd, todayYmd } from '../utils/helpers.js';

// ---------- Libros ----------
const bookSchema = tenantSchema(
  {
    isbn: { type: String, required: true, trim: true },
    titulo: { type: String, required: true, trim: true },
    autor: { type: String, required: true, trim: true },
    categoria: { type: String, required: true, trim: true },
    stockTotal: { type: Number, required: true, min: 0 },
    stockDisponible: { type: Number, required: true, min: 0 },
  },
  'books',
);
bookSchema.index({ appId: 1, isbn: 1 }, { unique: true });

export const Book = model('Book', bookSchema);

export const serializeBook = (b) => ({
  id: b.id,
  isbn: b.isbn,
  titulo: b.titulo,
  autor: b.autor,
  categoria: b.categoria,
  stockTotal: b.stockTotal,
  stockDisponible: b.stockDisponible,
});

// ---------- Préstamos de libros ----------
export const BOOK_LOAN_STATUS = ['PRESTADO', 'DEVUELTO'];

const bookLoanSchema = tenantSchema(
  {
    book: { type: Schema.Types.ObjectId, ref: 'Book', required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    fechaPrestamo: { type: Date, default: Date.now },
    fechaDevolucionEstimada: { type: String, required: true }, // YYYY-MM-DD
    fechaDevolucionReal: { type: Date, default: null },
    estatus: { type: String, enum: BOOK_LOAN_STATUS, default: 'PRESTADO' },
    observaciones: { type: String, default: '' },
  },
  'bookLoans',
);
bookLoanSchema.index({ appId: 1, user: 1, estatus: 1 });

export const BookLoan = model('BookLoan', bookLoanSchema);

export const serializeBookLoan = (l) => ({
  loanId: l.id,
  bookId: l.book?.id ?? null,
  libro: l.book?.titulo ?? null,
  isbn: l.book?.isbn ?? null,
  autor: l.book?.autor ?? null,
  userId: l.user?.id ?? null,
  usuario: l.user?.nombre ?? null,
  matricula: l.user?.matricula ?? null,
  estatus: l.estatus,
  fechaPrestamo: ymd(l.fechaPrestamo),
  fechaDevolucionEstimada: l.fechaDevolucionEstimada,
  fechaDevolucionReal: ymd(l.fechaDevolucionReal),
  vencido: l.estatus === 'PRESTADO' && l.fechaDevolucionEstimada < todayYmd(),
  observaciones: l.observaciones,
});
