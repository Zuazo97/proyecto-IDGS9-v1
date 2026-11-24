// Variables de entorno. Se leen en cada acceso para que los tests puedan definirlas antes de usar la app.
export const env = {
  get port() {
    return Number(process.env.PORT) || 3000;
  },
  get nodeEnv() {
    return process.env.NODE_ENV || 'development';
  },
  get mongoUri() {
    return process.env.MONGODB_URI;
  },
  get jwtSecret() {
    return process.env.JWT_SECRET;
  },
  get jwtExpiresIn() {
    return process.env.JWT_EXPIRES_IN || '8h';
  },
};

export function assertEnv() {
  const missing = ['MONGODB_URI', 'JWT_SECRET'].filter((k) => !process.env[k]);
  if (missing.length) {
    throw new Error(`Faltan variables de entorno: ${missing.join(', ')}. Revisa .env.example`);
  }
}
