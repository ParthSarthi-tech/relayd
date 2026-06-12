import { z } from 'zod'

export const kidParamsSchema = z.object({
  id: z.string().uuid(),
  kid: z.string().min(1).max(255),
})

export const keyResponseSchema = z.object({
  id: z.string().uuid(),
  kid: z.string(),
  status: z.enum(['active', 'retired']),
  createdAt: z.string(),
  retiredAt: z.string().nullable(),
})

export const createKeyResponseSchema = keyResponseSchema.extend({
  secret: z.string(),
})

export const revokeKeyParamsSchema = z.object({
  id: z.string().uuid(),
  kid: z.string().min(1).max(255),
})
