import mongoose, { Schema } from 'mongoose'

const CVSchema = new Schema({
  userId: { type: String, required: true },
  curriculaId: { type: String },
  nome: { type: String, required: true },
  cargo: { type: String, required: true },
  email: { type: String, required: true },
  tel: { type: String, required: true },
  cep: { type: String },
  cidade: { type: String },
  resumo: { type: String },
  empresa: { type: String },
  periodo: { type: String },
  atividades: { type: String }
}, { timestamps: true })

export const CV = mongoose.models.CV || mongoose.model('CV', CVSchema)