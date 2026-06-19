import { z } from 'zod'

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(5000),
  MONGODB_URI: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  SECRETS_ENCRYPTION_KEY: z.string().length(64),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CALLBACK_URL: z.string().url().optional(),
  AI_SERVICE_URL: z.string().url().default('http://ai:8001'),
  CLIENT_URL: z.string().url().default('http://localhost:8080'),
  SEED_ADMIN_EMAIL: z.string().email().default('admin@admin.com'),
  SEED_ADMIN_PASSWORD: z.string().min(8).default('changeme'),
})

const parsed = schema.safeParse(process.env)

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const env = parsed.data
