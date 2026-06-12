import { z } from 'zod'

export const createEndpointSchema = z.object({
  url: z.string().url().max(2048),
  description: z.string().max(500).optional(),
  eventTypes: z.array(z.string().min(1).max(255)).max(100).default([]),
  rateLimitPerSecond: z.number().int().positive().max(10_000).optional(),
  rateLimitBurst: z.number().int().positive().max(50_000).optional(),
  timeoutMs: z.number().int().positive().max(300_000).optional(),
  deadLetterWebhookUrl: z.string().url().max(2048).nullable().optional(),
})
export type CreateEndpointInput = z.infer<typeof createEndpointSchema>

export const updateEndpointSchema = createEndpointSchema.partial().extend({
  status: z.enum(['active', 'paused', 'disabled']).optional(),
})
export type UpdateEndpointInput = z.infer<typeof updateEndpointSchema>

export const endpointResponseSchema = z.object({
  id: z.string().uuid(),
  url: z.string(),
  description: z.string().nullable(),
  status: z.enum(['active', 'paused', 'disabled']),
  eventTypes: z.array(z.string()),
  rateLimitPerSecond: z.number().nullable(),
  rateLimitBurst: z.number().nullable(),
  timeoutMs: z.number().nullable(),
  deadLetterWebhookUrl: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})
