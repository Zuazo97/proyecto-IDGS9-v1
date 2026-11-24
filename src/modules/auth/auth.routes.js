import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import rateLimit from 'express-rate-limit';
import { User, serializeUser } from '../../models/User.js';
import { validate } from '../../middlewares/validate.js';
import { auth, signUserToken } from '../../middlewares/auth.js';
import { unauthorized } from '../../utils/httpError.js';

const router = Router();

const registerSchema = z.object({
  nombre: z.string().trim().min(2, 'El nombre es obligatorio (mínimo 2 caracteres)').max(100),
  matricula: z.string().trim().min(3, 'La matrícula es obligatoria').max(30),
  email: z.email('Email inválido').trim().toLowerCase(),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres').max(100),
  // Se acepta por compatibilidad con el contrato, pero el registro SIEMPRE crea rol USER.
  rol: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().min(1, 'El email es obligatorio'),
  password: z.string().min(1, 'La contraseña es obligatoria'),
});

// Máx. 20 intentos de login por minuto por equipo + email (los alumnos comparten IP de la escuela).
const loginLimiter = rateLimit({
  windowMs: 60_000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  keyGenerator: (req) => `${req.get('x-api-token')}|${String(req.body?.email || '').toLowerCase()}`,
  message: { message: 'Demasiados intentos de inicio de sesión, espera un minuto', code: 'RATE_LIMIT' },
});

router.post('/register', validate(registerSchema), async (req, res) => {
  const { nombre, matricula, email, password } = req.valid.body;
  const user = await User.create({
    appId: req.tenant._id,
    nombre,
    matricula,
    email,
    password: await bcrypt.hash(password, 10),
    rol: 'USER',
  });
  res.status(201).json({ message: 'Usuario registrado', user: serializeUser(user) });
});

router.post('/login', loginLimiter, validate(loginSchema), async (req, res) => {
  const { email, password } = req.valid.body;
  const user = await User.findOne({ appId: req.tenant._id, email }).select('+password');
  if (!user || !(await bcrypt.compare(password, user.password))) {
    throw unauthorized('Email o contraseña incorrectos', 'INVALID_CREDENTIALS');
  }
  if (!user.activo) throw unauthorized('Usuario desactivado, contacta al administrador', 'USER_INACTIVE');

  res.json({ token: signUserToken(user, req.tenant), user: serializeUser(user) });
});

// Extra: datos del usuario autenticado (útil para restaurar sesión al abrir la app).
router.get('/me', auth, (req, res) => {
  res.json({ user: serializeUser(req.user) });
});

export default router;
