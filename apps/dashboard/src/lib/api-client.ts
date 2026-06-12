import type {
  ApiKey,
  Attempt,
  Connection,
  DashboardStats,
  Endpoint,
  Message,
  SigningKey,
  Transformation,
} from './types'

const BASE_URL = import.meta.env.VITE_API_URL || ''
const APP_BASE = import.meta.env.BASE_URL
export function getApiBaseUrl() {
  return BASE_URL || window.location.origin
}

class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers })

  if (res.status === 401) {
    localStorage.removeItem('relay_user')
    window.location.href = `${APP_BASE}login`
    throw new ApiError(401, 'unauthorized', 'Session expired')
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new ApiError(
      res.status,
      body?.error?.code || 'unknown',
      body?.error?.message || `Request failed with status ${res.status}`,
    )
  }

  return res.json()
}

export const api = {
  // Dashboard stats
  getStats(period = 24): Promise<DashboardStats> {
    return request(`/v1/stats?period=${period}`)
  },

  // Endpoints
  listEndpoints(
    limit = 20,
    cursor?: string,
  ): Promise<{ data: Endpoint[]; pagination: { hasMore: boolean; nextCursor: string | null } }> {
    const params = new URLSearchParams({ limit: String(limit) })
    if (cursor) params.set('cursor', cursor)
    return request(`/v1/endpoints?${params}`)
  },

  getEndpoint(id: string): Promise<Endpoint> {
    return request(`/v1/endpoints/${id}`)
  },

  createEndpoint(data: {
    url: string
    description?: string
    eventTypes?: string[]
    rateLimitPerSecond?: number
    rateLimitBurst?: number
    timeoutMs?: number
  }): Promise<Endpoint & { secret: string }> {
    return request('/v1/endpoints', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  updateEndpoint(
    id: string,
    data: Partial<{
      url: string
      description: string
      eventTypes: string[]
      rateLimitPerSecond: number
      rateLimitBurst: number
      timeoutMs: number
      status: string
    }>,
  ): Promise<Endpoint> {
    return request(`/v1/endpoints/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  },

  deleteEndpoint(id: string): Promise<{ id: string; deleted: boolean }> {
    return request(`/v1/endpoints/${id}`, { method: 'DELETE' })
  },

  // Signing Keys
  listKeys(endpointId: string): Promise<{ data: SigningKey[] }> {
    return request(`/v1/endpoints/${endpointId}/keys`)
  },

  createKey(endpointId: string): Promise<SigningKey & { secret: string }> {
    return request(`/v1/endpoints/${endpointId}/keys`, { method: 'POST' })
  },

  revokeKey(
    endpointId: string,
    kid: string,
  ): Promise<{ id: string; kid: string; status: string; revoked: boolean }> {
    return request(`/v1/endpoints/${endpointId}/keys/${kid}/revoke`, { method: 'POST' })
  },

  // Messages
  listMessages(
    params: {
      endpointId?: string
      status?: string
      eventType?: string
      dateFrom?: string
      dateTo?: string
      cursor?: string
      limit?: number
    } = {},
  ): Promise<{ data: Message[]; pagination: { hasMore: boolean; nextCursor: string | null } }> {
    const searchParams = new URLSearchParams()
    if (params.limit) searchParams.set('limit', String(params.limit))
    if (params.endpointId) searchParams.set('endpointId', params.endpointId)
    if (params.status) searchParams.set('status', params.status)
    if (params.eventType) searchParams.set('eventType', params.eventType)
    if (params.dateFrom) searchParams.set('dateFrom', params.dateFrom)
    if (params.dateTo) searchParams.set('dateTo', params.dateTo)
    if (params.cursor) searchParams.set('cursor', params.cursor)
    return request(`/v1/messages?${searchParams}`)
  },

  getMessage(id: string): Promise<Message & { attempts: Attempt[] }> {
    return request(`/v1/messages/${id}`)
  },

  replayMessage(id: string): Promise<{ id: string; status: string; replayed: boolean }> {
    return request(`/v1/messages/${id}/replay`, { method: 'POST' })
  },

  deleteMessage(id: string): Promise<{ id: string; deleted: boolean }> {
    return request(`/v1/messages/${id}`, { method: 'DELETE' })
  },

  batchReplayMessages(ids: string[]): Promise<{
    data: { id: string; status: string; replayed: boolean; error?: string }[]
    summary: { total: number; replayed: number }
  }> {
    return request('/v1/messages/batch-replay', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    })
  },

  batchDeleteMessages(
    ids: string[],
  ): Promise<{
    data: { id: string; deleted: boolean; error?: string }[]
    summary: { total: number; deleted: number }
  }> {
    return request('/v1/messages/batch-delete', {
      method: 'POST',
      body: JSON.stringify({ ids }),
    })
  },

  sendEvent(
    endpointId: string,
    eventType: string,
    payload: Record<string, unknown>,
  ): Promise<{ id: string; status: string }> {
    return request('/v1/events', {
      method: 'POST',
      body: JSON.stringify({
        endpointId,
        eventId: `test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        eventType,
        payload,
      }),
    })
  },

  // API Keys
  listApiKeys(): Promise<{ data: ApiKey[] }> {
    return request('/v1/api-keys')
  },

  createApiKey(data: {
    name: string
    scopes?: string[]
  }): Promise<{ id: string; name: string; keyPrefix: string; fullKey: string; scopes: string[] }> {
    return request('/v1/api-keys', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  revokeApiKey(id: string): Promise<{ id: string; revoked: boolean }> {
    return request(`/v1/api-keys/${id}/revoke`, { method: 'POST' })
  },

  // Transformations
  listTransformations(limit = 50): Promise<{ data: Transformation[] }> {
    const params = new URLSearchParams({ limit: String(limit) })
    return request(`/v1/transformations?${params}`)
  },

  createTransformation(data: {
    name: string
    description?: string
    code: string
  }): Promise<Transformation> {
    return request('/v1/transformations', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  updateTransformation(
    id: string,
    data: Partial<{ name: string; description: string; code: string }>,
  ): Promise<Transformation> {
    return request(`/v1/transformations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  },

  deleteTransformation(id: string): Promise<{ id: string; deleted: boolean }> {
    return request(`/v1/transformations/${id}`, { method: 'DELETE' })
  },

  testTransformation(
    id: string,
    payload: Record<string, unknown>,
    headers?: Record<string, string>,
  ): Promise<{
    success: boolean
    output?: { payload: Record<string, unknown>; headers: Record<string, string> }
    error?: string
  }> {
    return request(`/v1/transformations/${id}/test`, {
      method: 'POST',
      body: JSON.stringify({ payload, headers }),
    })
  },

  // Connections
  listConnections(limit = 50): Promise<{ data: Connection[] }> {
    const params = new URLSearchParams({ limit: String(limit) })
    return request(`/v1/connections?${params}`)
  },

  createConnection(data: {
    name: string
    description?: string
    endpointId: string
    transformationId?: string | null
    filterRules?: { conditions: Array<{ field: string; op: string; value: unknown }> } | null
    enabled?: boolean
  }): Promise<Connection> {
    return request('/v1/connections', {
      method: 'POST',
      body: JSON.stringify(data),
    })
  },

  updateConnection(
    id: string,
    data: Partial<{
      name: string
      description: string
      endpointId: string
      transformationId: string | null
      filterRules: { conditions: Array<{ field: string; op: string; value: unknown }> } | null
      enabled: boolean
    }>,
  ): Promise<Connection> {
    return request(`/v1/connections/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    })
  },

  deleteConnection(id: string): Promise<{ id: string; deleted: boolean }> {
    return request(`/v1/connections/${id}`, { method: 'DELETE' })
  },
}
