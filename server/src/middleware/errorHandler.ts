import type { Request, Response, NextFunction } from 'express'
import { AppError } from '../lib/errors.js'
import { ZodError } from 'zod'

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message, code: err.code })
    return
  }
  if (err instanceof ZodError) {
    res.status(422).json({ error: 'Validation failed', issues: err.flatten().fieldErrors })
    return
  }
  console.error(err)
  res.status(500).json({ error: 'Internal server error' })
}
