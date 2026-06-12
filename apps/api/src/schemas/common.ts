import { z } from 'zod'

export const uuidSchema = z.string().uuid()

export const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().optional(),
})
export type Pagination = z.infer<typeof paginationSchema>

export const idParamsSchema = z.object({
  id: uuidSchema,
})
