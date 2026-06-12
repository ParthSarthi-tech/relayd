import { z } from 'zod'
import { uuidSchema } from './common.js'

export const createEventSchema = z.object({
  endpointId: uuidSchema,
  eventId: z.string().min(1).max(255),
  eventType: z.string().min(1).max(255),
  payload: z.record(z.unknown()),
})
export type CreateEventInput = z.infer<typeof createEventSchema>

export const createBatchEventsSchema = z.object({
  events: z.array(createEventSchema).min(1).max(1000),
})
export type CreateBatchEventsInput = z.infer<typeof createBatchEventsSchema>

export const messageResponseSchema = z.object({
  id: z.string().uuid(),
  endpointId: z.string().uuid(),
  eventId: z.string(),
  eventType: z.string(),
  status: z.enum(['pending', 'processing', 'delivered', 'failed', 'dead_letter']),
  attemptCount: z.number().int(),
  createdAt: z.string(),
})
