import mongoose from 'mongoose';

mongoose.set('strictQuery', true);

export async function connectDB(uri) {
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 });
  return mongoose.connection;
}

export async function disconnectDB() {
  await mongoose.disconnect();
}

const STATES = ['desconectado', 'conectado', 'conectando', 'desconectando'];
export const dbState = () => STATES[mongoose.connection.readyState] ?? 'desconocido';
