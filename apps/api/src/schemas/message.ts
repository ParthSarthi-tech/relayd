import { z } from 'zod'

export const messageStatusEnumSchema = z.enum([
  'pending',
  'processing',
  'delivered',
  'failed',
  'dead_letter',
])

export const messageQuerySchema = z.object({
  endpointId: z.string().uuid().optional(),
  status: messageStatusEnumSchema.optional(),
  eventType: z.string().max(255).optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().uuid().optional(),
})

export const attemptResponseSchema = z.object({
  id: z.string().uuid(),
  attemptNumber: z.number().int(),
  status: z.enum(['success', 'failed', 'timeout', 'connection_error']),
  httpStatus: z.number().int().nullable(),
  responseBody: z.string().nullable(),
  durationMs: z.number().int().nullable(),
  errorMessage: z.string().nullable(),
  attemptedAt: z.string(),
  requestUrl: z.string(),
})

export const messageResponseSchema = z.object({
  id: z.string().uuid(),
  endpointId: z.string().uuid(),
  eventId: z.string(),
  eventType: z.string(),
  status: messageStatusEnumSchema,
  attemptCount: z.number().int(),
  lastError: z.string().nullable(),
  nextRetryAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  deliveredAt: z.string().nullable(),
})

export const messageDetailResponseSchema = messageResponseSchema.extend({
  attempts: z.array(attemptResponseSchema),
})

export const batchReplaySchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
})

export const batchDeleteSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
})

export const replayParamsSchema = z.object({
  id: z.string().uuid(),
})
