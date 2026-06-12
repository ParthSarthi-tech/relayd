import { Hono } from 'hono'

export function echoRoutes() {
  return new Hono().post('/', async (c) => {
    const body = await c.req.json().catch(() => ({}))
    const headers: Record<string, string> = {}
    c.req.raw.headers.forEach((v, k) => {
      headers[k] = v
    })
    return c.json({
      received: true,
      method: c.req.method,
      path: c.req.path,
      headers,
      body,
      timestamp: new Date().toISOString(),
    })
  })
}
