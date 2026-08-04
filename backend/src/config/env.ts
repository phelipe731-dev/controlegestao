import dotenv from 'dotenv'
import { z } from 'zod'

dotenv.config()

const optionalString = z.preprocess((value) => (value === '' ? undefined : value), z.string().optional())
const optionalUrl = z.preprocess((value) => (value === '' ? undefined : value), z.string().url().optional())

const envSchema = z.object({
  PORT: z.coerce.number().default(3333),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET precisa ter ao menos 16 caracteres'),
  JWT_EXPIRES_IN: z.string().default('12h'),
  DATABASE_URL: z.string().min(1),
  UPLOAD_DIR: z.string().min(1).default('/app/uploads'),
  EVOLUTION_API_URL: optionalUrl,
  EVOLUTION_API_KEY: optionalString.refine((value) => !value || value.length >= 8, 'EVOLUTION_API_KEY precisa ter ao menos 8 caracteres'),
  EVOLUTION_INSTANCE_NAME: z.string().min(1).default('campanhahub'),
  EVOLUTION_WEBHOOK_URL: optionalUrl,
  EVOLUTION_WEBHOOK_SECRET: optionalString.refine((value) => !value || value.length >= 12, 'EVOLUTION_WEBHOOK_SECRET precisa ter ao menos 12 caracteres'),
  WAHA_API_URL: optionalUrl,
  WAHA_API_KEY: optionalString.refine((value) => !value || value.length >= 8, 'WAHA_API_KEY precisa ter ao menos 8 caracteres'),
  WAHA_SESSION: z.string().min(1).default('default'),
  WAHA_WEBHOOK_URL: optionalUrl,
  WAHA_WEBHOOK_SECRET: optionalString.refine((value) => !value || value.length >= 12, 'WAHA_WEBHOOK_SECRET precisa ter ao menos 12 caracteres'),
})

export const env = envSchema.parse(process.env)
