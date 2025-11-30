import mongoose, { Schema } from 'mongoose'

const CVVersionSchema = new Schema({
  curriculaId: { type: String, required: true },
  userId: { type: String, required: true },
  data: { type: Object, required: true }
}, { timestamps: true })

export const CVVersion = mongoose.models.CVVersion || mongoose.model('CVVersion', CVVersionSchema)