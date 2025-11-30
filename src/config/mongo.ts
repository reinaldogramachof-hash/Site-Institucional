import mongoose from 'mongoose'
import { env } from './env'

export async function connectMongo() {
  if (!env.MONGO_URI) return
  await mongoose.connect(env.MONGO_URI)
}