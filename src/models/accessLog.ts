import mongoose, { Schema } from 'mongoose'

const AccessLogSchema = new Schema({
  userId: { type: String, required: true },
  method: { type: String, required: true },
  path: { type: String, required: true },
  ip: { type: String }
}, { timestamps: true })

export const AccessLog = mongoose.models.AccessLog || mongoose.model('AccessLog', AccessLogSchema)