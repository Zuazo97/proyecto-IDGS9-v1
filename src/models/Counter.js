import { Schema, model } from 'mongoose';

// Secuencias para exponer IDs numéricos (1, 2, 3...) como en los contratos de la API.
const counterSchema = new Schema({ _id: String, seq: { type: Number, default: 0 } }, { versionKey: false });

export const Counter = model('Counter', counterSchema);

export async function nextSeq(name) {
  const doc = await Counter.findOneAndUpdate(
    { _id: name },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' },
  );
  return doc.seq;
}

/**
 * Crea un Schema con: id numérico autoincremental, appId (equipo dueño del dato),
 * timestamps y sin el virtual "id" de Mongoose.
 */
export function tenantSchema(definition, counterName, options = {}) {
  const schema = new Schema(
    {
      id: { type: Number, index: true },
      appId: { type: Schema.Types.ObjectId, ref: 'App', required: true, index: true },
      ...definition,
    },
    { timestamps: true, versionKey: false, id: false, ...options },
  );
  schema.pre('validate', async function assignId() {
    if (this.isNew && this.id == null) this.id = await nextSeq(counterName);
  });
  return schema;
}
