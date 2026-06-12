import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * HMAC-SHA256 signing for webhook payloads.
 * Scheme: HMAC-SHA256(timestamp + "." + body)
 * Header format: `t=<timestamp>,v1=<signature>`
 * (Compatible with Stripe's webhook signature scheme.)
 */

export interface SignOptions {
  secret: string
  body: string
  timestamp?: number
  algorithm?: 'sha256' | 'sha512'
}

export interface SignedPayload {
  signature: string
  timestamp: number
  header: string
}

export function signPayload(opts: SignOptions): SignedPayload {
  const ts = opts.timestamp ?? Math.floor(Date.now() / 1000)
  const algo = opts.algorithm ?? 'sha256'
  const signedPayload = `${ts}.${opts.body}`
  const signature = createHmac(algo, opts.secret).update(signedPayload).digest('hex')
  const versionPrefix = algo === 'sha256' ? 'v1' : 'v2'
  return {
    signature,
    timestamp: ts,
    header: `t=${ts},${versionPrefix}=${signature}`,
  }
}

export interface VerifyOptions {
  secret: string
  body: string
  header: string
  toleranceSeconds?: number
}

export interface VerifyResult {
  valid: boolean
  reason?: 'malformed' | 'expired' | 'mismatch'
}

export function verifyPayload(opts: VerifyOptions): VerifyResult {
  const tolerance = opts.toleranceSeconds ?? 300 // 5 min default
  const parts = parseHeader(opts.header)
  if (!parts) return { valid: false, reason: 'malformed' }

  const tsAge = Math.abs(Math.floor(Date.now() / 1000) - parts.timestamp)
  if (tsAge > tolerance) return { valid: false, reason: 'expired' }

  const algo = parts.version === 'v1' ? 'sha256' : 'sha512'
  const expected = createHmac(algo, opts.secret)
    .update(`${parts.timestamp}.${opts.body}`)
    .digest('hex')

  if (expected.length !== parts.signature.length) {
    return { valid: false, reason: 'mismatch' }
  }
  return {
    valid: timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(parts.signature, 'hex')),
    ...(expected.length === parts.signature.length ? {} : {}),
    reason: expected.length === parts.signature.length ? undefined : 'mismatch',
  }
}

function parseHeader(
  header: string,
): { timestamp: number; signature: string; version: string } | null {
  const parts = header.split(',').map((p) => p.trim())
  let timestamp = 0
  let signature = ''
  let version = 'v1'
  for (const part of parts) {
    const eq = part.indexOf('=')
    if (eq < 0) return null
    const key = part.slice(0, eq)
    const value = part.slice(eq + 1)
    if (key === 't') {
      const parsed = Number.parseInt(value, 10)
      if (Number.isNaN(parsed)) return null
      timestamp = parsed
    } else if (key === 'v1' || key === 'v2') {
      version = key
      signature = value
    }
  }
  if (!timestamp || !signature) return null
  return { timestamp, signature, version }
}
