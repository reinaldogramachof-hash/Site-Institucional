import { Request, Response, NextFunction } from 'express'
import Joi from 'joi'

export function validate(schema: Joi.ObjectSchema, source: 'body' | 'query' | 'params' = 'body') {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error } = schema.validate(req[source], { abortEarly: false })
    if (error) return res.status(400).json({ error: 'validation', details: error.details })
    next()
  }
}