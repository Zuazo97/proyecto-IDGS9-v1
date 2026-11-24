import { createApp } from './app.js';
import { connectDB } from './config/db.js';
import { env, assertEnv } from './config/env.js';

assertEnv();
await connectDB(env.mongoUri);
console.log('MongoDB conectado');

const server = createApp().listen(env.port, () => {
  console.log(`API escuchando en http://localhost:${env.port}  (docs: /api/docs)`);
});

const shutdown = (signal) => {
  console.log(`${signal} recibido, cerrando...`);
  server.close(() => process.exit(0));
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
