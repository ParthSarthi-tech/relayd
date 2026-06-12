import 'hono'

declare module 'hono' {
  interface ContextVariableMap {
    tenantId: string
    userId: string
    role: string
  }
}
