import dotenv from 'dotenv'
import { z } from 'zod'

dotenv.config()

const envSchema = z.object({
  PORT: z.coerce.number().default(3333),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET precisa ter ao menos 16 caracteres'),
  JWT_EXPIRES_IN: z.string().default('12h'),
  DATABASE_URL: z.string().min(1),
  UPLOAD_DIR: z.string().min(1).default('/app/uploads'),
  EVOLUTION_API_URL: z.string().url().optional(),
  EVOLUTION_API_KEY: z.string().min(8).optional(),
  EVOLUTION_INSTANCE_NAME: z.string().min(1).default('campanhahub'),
  EVOLUTION_WEBHOOK_URL: z.string().url().optional(),
  EVOLUTION_WEBHOOK_SECRET: z.string().min(12).optional(),
})

export const env = envSchema.parse(process.env)
