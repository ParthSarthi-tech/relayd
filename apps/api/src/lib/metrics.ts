import promClient from 'prom-client'

const register = new promClient.Registry()

promClient.collectDefaultMetrics({ register })

const httpRequestDuration = new promClient.Histogram({
  name: 'relay_http_request_duration_ms',
  help: 'HTTP request duration in milliseconds',
  labelNames: ['method', 'path', 'status'],
  buckets: [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000],
  registers: [register],
})

const httpRequestsTotal = new promClient.Counter({
  name: 'relay_http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'path', 'status'],
  registers: [register],
})

const rateLimitedRequests = new promClient.Counter({
  name: 'relay_rate_limited_requests_total',
  help: 'Total number of requests rejected by rate limiting',
  labelNames: ['endpoint_id'],
  registers: [register],
})

const activeEndpoints = new promClient.Gauge({
  name: 'relay_active_endpoints',
  help: 'Number of active endpoints',
  registers: [register],
})

const messagesEnqueuedTotal = new promClient.Counter({
  name: 'relay_messages_enqueued_total',
  help: 'Total number of events enqueued for delivery',
  labelNames: ['status'],
  registers: [register],
})

const rateLimitRemaining = new promClient.Gauge({
  name: 'relay_rate_limit_remaining',
  help: 'Remaining rate limit capacity per endpoint',
  labelNames: ['key'],
  registers: [register],
})

export function getMetricsRegister(): promClient.Registry {
  return register
}

export function incrementRateLimited(endpointId: string): void {
  rateLimitedRequests.inc({ endpoint_id: endpointId })
}

export function setRateLimitRemaining(key: string, remaining: number): void {
  rateLimitRemaining.set({ key }, remaining)
}

export function incrementMessagesEnqueued(status: 'created' | 'deduped'): void {
  messagesEnqueuedTotal.inc({ status })
}

export function setActiveEndpoints(count: number): void {
  activeEndpoints.set(count)
}

export function recordHttpRequest(
  method: string,
  path: string,
  status: number,
  durationMs: number,
): void {
  httpRequestsTotal.inc({ method, path, status })
  httpRequestDuration.observe({ method, path, status }, durationMs)
}

export async function metricsHandler(): Promise<Response> {
  const body = await register.metrics()
  return new Response(body, {
    status: 200,
    headers: { 'Content-Type': register.contentType },
  })
}
