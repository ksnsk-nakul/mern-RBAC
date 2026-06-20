import type { Request, Response, NextFunction } from 'express'
import { AppError } from '../lib/errors.js'
import { ZodError } from 'zod'

interface MongoDuplicateKeyError {
  code: number
  keyPattern?: Record<string, unknown>
  keyValue?: Record<string, unknown>
}

function isDuplicateKeyError(err: unknown): err is MongoDuplicateKeyError {
  return (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code: unknown }).code === 11000
  )
}

interface MongooseValidationError {
  name: 'ValidationError'
  errors: Record<string, { message: string }>
}

function isMongooseValidationError(err: unknown): err is MongooseValidationError {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { name?: unknown }).name === 'ValidationError'
  )
}

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
  if (isDuplicateKeyError(err)) {
    const field = err.keyPattern
      ? Object.keys(err.keyPattern)[0]
      : err.keyValue
        ? Object.keys(err.keyValue)[0]
        : 'field'
    res.status(409).json({ error: `Duplicate value for ${field}`, code: 'DUPLICATE_KEY' })
    return
  }
  if (isMongooseValidationError(err)) {
    const issues = Object.fromEntries(
      Object.entries(err.errors).map(([key, value]) => [key, value.message]),
    )
    res.status(400).json({ error: 'Validation failed', issues })
    return
  }
  console.error(err)
  res.status(500).json({ error: 'Internal server error' })
}
