import { Router } from 'express';
import { z } from 'zod';
import { User, ROLES, serializeUser } from '../../models/User.js';
import { validate } from '../../middlewares/validate.js';
import { auth, requireRole } from '../../middlewares/auth.js';
import { parseId, containsRegex } from '../../utils/helpers.js';
import { notFound, conflict } from '../../utils/httpError.js';

const router = Router();
router.use(auth, requireRole('ADMIN'));

const listQuery = z.object({
  search: z.string().optional(),
  rol: z.enum(ROLES).optional(),
  activo: z.enum(['true', 'false']).optional(),
});

router.get('/', validate(listQuery, 'query'), async (req, res) => {
  const { search, rol, activo } = req.valid.query;
  const filter = { appId: req.tenant._id };
  if (search?.trim()) {
    const rx = containsRegex(search);
    filter.$or = [{ nombre: rx }, { matricula: rx }, { email: rx }];
  }
  if (rol) filter.rol = rol;
  if (activo) filter.activo = activo === 'true';
  const users = await User.find(filter).sort({ id: 1 });
  res.json(users.map(serializeUser));
});

router.get('/:id', async (req, res) => {
  const user = await User.findOne({ appId: req.tenant._id, id: parseId(req.params.id) });
  if (!user) throw notFound('Usuario no encontrado');
  res.json(serializeUser(user));
});

async function findTarget(req) {
  const user = await User.findOne({ appId: req.tenant._id, id: parseId(req.params.id) });
  if (!user) throw notFound('Usuario no encontrado');
  return user;
}

router.patch('/:id/role', validate(z.object({ rol: z.enum(ROLES, 'rol debe ser "ADMIN" o "USER"') })), async (req, res) => {
  const user = await findTarget(req);
  const { rol } = req.valid.body;
  if (user.id === req.user.id && rol !== 'ADMIN') {
    throw conflict('No puedes quitarte a ti mismo el rol ADMIN', 'SELF_DEMOTION');
  }
  user.rol = rol;
  await user.save();
  res.json({ message: 'Rol actualizado', user: serializeUser(user) });
});

// Extra: activar / desactivar usuario (la pantalla 3 muestra el estatus "activo").
router.patch('/:id/status', validate(z.object({ activo: z.boolean('activo debe ser true o false') })), async (req, res) => {
  const user = await findTarget(req);
  const { activo } = req.valid.body;
  if (user.id === req.user.id && !activo) {
    throw conflict('No puedes desactivar tu propia cuenta', 'SELF_DEACTIVATION');
  }
  user.activo = activo;
  await user.save();
  res.json({ message: activo ? 'Usuario activado' : 'Usuario desactivado', user: serializeUser(user) });
});

export default router;
