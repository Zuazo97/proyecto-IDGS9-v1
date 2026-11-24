import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import { dbState } from './config/db.js';
import { appToken } from './middlewares/appToken.js';
import { errorHandler, notFoundHandler } from './middlewares/errorHandler.js';
import authRoutes from './modules/auth/auth.routes.js';
import usersRoutes from './modules/users/users.routes.js';
import { mountModules } from './modules/index.js';
import { mountDocs } from './docs/docs.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1); // Render está detrás de un proxy
  app.disable('x-powered-by');
  app.use(helmet({ contentSecurityPolicy: false })); // CSP desactivada para que cargue Swagger UI
  app.use(cors()); // Abierto: Vercel/Netlify/Expo usan orígenes variables. La seguridad va en los tokens.
  app.use(express.json({ limit: '100kb' }));
  if (env.nodeEnv !== 'test') app.use(morgan(env.nodeEnv === 'production' ? 'tiny' : 'dev'));

  // Rutas públicas (sin x-api-token)
  app.get('/', (_req, res) => res.redirect('/api/docs'));
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', db: dbState(), uptime: Math.round(process.uptime()), time: new Date().toISOString() });
  });
  mountDocs(app);

  // Todo lo demás bajo /api exige x-api-token
  const api = express.Router();
  api.use(appToken);
  api.use(
    rateLimit({
      windowMs: 60_000,
      limit: 600,
      standardHeaders: 'draft-8',
      legacyHeaders: false,
      keyGenerator: (req) => req.tenant.token,
      message: { message: 'Demasiadas peticiones, espera un minuto', code: 'RATE_LIMIT' },
    }),
  );
  api.use('/auth', authRoutes);
  api.use('/users', usersRoutes);
  mountModules(api);
  app.use('/api', api);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
