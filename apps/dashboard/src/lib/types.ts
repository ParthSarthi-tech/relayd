export interface Endpoint {
  id: string
  url: string
  description: string | null
  status: 'active' | 'paused' | 'disabled'
  eventTypes: string[]
  rateLimitPerSecond: number | null
  rateLimitBurst: number | null
  timeoutMs: number | null
  deadLetterWebhookUrl: string | null
  createdAt: string
  updatedAt: string
}

export interface SigningKey {
  id: string
  kid: string
  status: 'active' | 'retired'
  createdAt: string
  retiredAt: string | null
}

export type MessageStatus = 'pending' | 'processing' | 'delivered' | 'failed' | 'dead_letter'

export interface Message {
  id: string
  endpointId: string
  eventId: string
  eventType: string
  status: MessageStatus
  attemptCount: number
  lastError: string | null
  nextRetryAt: string | null
  createdAt: string
  updatedAt: string
  deliveredAt: string | null
  payload: Record<string, unknown>
}

export type AttemptStatus = 'success' | 'failed' | 'timeout' | 'connection_error'

export interface Attempt {
  id: string
  attemptNumber: number
  status: AttemptStatus
  httpStatus: number | null
  responseBody: string | null
  durationMs: number | null
  errorMessage: string | null
  attemptedAt: string
  requestUrl: string
}

export interface Transformation {
  id: string
  name: string
  description: string | null
  code: string
  createdAt: string
  updatedAt: string
}

export interface ApiKey {
  id: string
  name: string
  keyPrefix: string
  scopes: string[]
  active: boolean
  expiresAt: string | null
  lastUsedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface Connection {
  id: string
  name: string
  description: string | null
  endpointId: string
  transformationId: string | null
  filterRules: { conditions: Array<{ field: string; op: string; value: unknown }> } | null
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export interface DashboardStats {
  periodHours: number
  activeEndpoints: number
  totalMessages: number
  deliveredCount: number
  failedCount: number
  pendingCount: number
  deadLetterCount: number
  successRate: number
  successAttempts: number
  latencyMs: {
    avg: number
    p50: number
    p95: number
    p99: number
  }
  timeline: Array<{
    hour: string
    delivered: number
    failed: number
    pending: number
    dead: number
  }>
}
