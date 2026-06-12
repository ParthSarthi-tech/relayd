import type { Database } from '@relay/db/client'
import { auditLogs } from '@relay/db/schema'
import type { Context } from 'hono'

export type AuditAction =
  | 'endpoint.created'
  | 'endpoint.updated'
  | 'endpoint.deleted'
  | 'endpoint.paused'
  | 'endpoint.resumed'
  | 'key.created'
  | 'key.revoked'
  | 'api_key.created'
  | 'api_key.revoked'

export interface AuditInput {
  tenantId: string
  action: AuditAction
  endpointId?: string
  metadata?: Record<string, unknown>
  ip?: string | null
}

export async function writeAuditLog(db: Database, input: AuditInput): Promise<void> {
  await db.insert(auditLogs).values({
    tenantId: input.tenantId,
    endpointId: input.endpointId ?? null,
    action: input.action,
    metadata: input.metadata ?? null,
    ip: input.ip ?? null,
  })
}

/** Extract client IP from a Hono context. */
export function getClientIp(c: Context): string | null {
  const forwarded = c.req.header('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0]?.trim() ?? null
  const realIp = c.req.header('x-real-ip')
  if (realIp) return realIp
  return c.req.header('cf-connecting-ip') ?? null
}

/** Convenience helper that writes an audit log for the current tenant. */
export function audit(c: Context, db: Database) {
  return (action: AuditAction, input?: Omit<AuditInput, 'tenantId' | 'action' | 'ip'>) =>
    writeAuditLog(db, {
      tenantId: c.get('tenantId') as string,
      action,
      ip: getClientIp(c),
      ...(input ?? {}),
    })
}
