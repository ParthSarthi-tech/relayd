const USER_KEY = 'relay_user'
const TENANT_KEY = 'relay_tenant'

export function getStoredUser(): { id: string; email: string; name: string; role: string } | null {
  const raw = localStorage.getItem(USER_KEY)
  return raw ? JSON.parse(raw) : null
}

export function getStoredTenant(): { id: string; name: string; slug: string } | null {
  const raw = localStorage.getItem(TENANT_KEY)
  return raw ? JSON.parse(raw) : null
}

export interface AuthResponse {
  token: string
  user: { id: string; email: string; name: string; role: string }
  tenant: { id: string; name: string; slug: string }
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const res = await fetch('/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.error?.message || 'Login failed')
  }
  const data: AuthResponse = await res.json()
  localStorage.setItem(USER_KEY, JSON.stringify(data.user))
  localStorage.setItem(TENANT_KEY, JSON.stringify(data.tenant))
  return data
}

export async function register(data: {
  email: string
  password: string
  name: string
  tenantName?: string
}): Promise<AuthResponse> {
  const res = await fetch('/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body?.error?.message || 'Registration failed')
  }
  const result: AuthResponse = await res.json()
  localStorage.setItem(USER_KEY, JSON.stringify(result.user))
  localStorage.setItem(TENANT_KEY, JSON.stringify(result.tenant))
  return result
}

const BASE = import.meta.env.BASE_URL

export function logout(): void {
  fetch('/auth/logout', { method: 'POST' }).catch(() => {})
  localStorage.removeItem(USER_KEY)
  window.location.href = `${BASE}login`
}

export function isAuthenticated(): boolean {
  return !!getStoredUser()
}

export function useAuth() {
  return {
    isAuthenticated: isAuthenticated(),
    login,
    register,
    logout,
  }
}
