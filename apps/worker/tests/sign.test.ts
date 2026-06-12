import { describe, expect, it } from 'vitest'
import { signPayload, verifyPayload } from '../src/sign.js'

const SECRET = 'whsec_test_super_secret_key_that_is_long_enough'

describe('signPayload', () => {
  it('produces a header in t=...,v1=... format', () => {
    const result = signPayload({ secret: SECRET, body: '{"hello":"world"}' })
    expect(result.header).toMatch(/^t=\d+,v1=[a-f0-9]{64}$/)
  })

  it('uses the provided timestamp when given', () => {
    const result = signPayload({ secret: SECRET, body: 'x', timestamp: 1700000000 })
    expect(result.timestamp).toBe(1700000000)
    expect(result.header.startsWith('t=1700000000,')).toBe(true)
  })

  it('produces deterministic output for the same inputs', () => {
    const a = signPayload({ secret: SECRET, body: 'x', timestamp: 1700000000 })
    const b = signPayload({ secret: SECRET, body: 'x', timestamp: 1700000000 })
    expect(a.signature).toBe(b.signature)
  })

  it('produces different signatures for different bodies', () => {
    const a = signPayload({ secret: SECRET, body: 'x', timestamp: 1700000000 })
    const b = signPayload({ secret: SECRET, body: 'y', timestamp: 1700000000 })
    expect(a.signature).not.toBe(b.signature)
  })

  it('produces different signatures for different secrets', () => {
    const a = signPayload({ secret: SECRET, body: 'x', timestamp: 1700000000 })
    const b = signPayload({ secret: 'other_secret', body: 'x', timestamp: 1700000000 })
    expect(a.signature).not.toBe(b.signature)
  })

  it('uses v2 prefix for sha512', () => {
    const result = signPayload({ secret: SECRET, body: 'x', algorithm: 'sha512' })
    expect(result.header.startsWith('t=')).toBe(true)
    expect(result.header).toContain(',v2=')
  })
})

describe('verifyPayload', () => {
  it('round-trips: sign then verify succeeds', () => {
    const body = '{"event":"test"}'
    const { header } = signPayload({
      secret: SECRET,
      body,
      timestamp: Math.floor(Date.now() / 1000),
    })
    const result = verifyPayload({ secret: SECRET, body, header })
    expect(result.valid).toBe(true)
  })

  it('rejects when body is tampered with', () => {
    const { header } = signPayload({
      secret: SECRET,
      body: 'a',
      timestamp: Math.floor(Date.now() / 1000),
    })
    const result = verifyPayload({ secret: SECRET, body: 'b', header })
    expect(result.valid).toBe(false)
  })

  it('rejects when secret is wrong', () => {
    const { header } = signPayload({
      secret: SECRET,
      body: 'x',
      timestamp: Math.floor(Date.now() / 1000),
    })
    const result = verifyPayload({ secret: 'wrong_secret', body: 'x', header })
    expect(result.valid).toBe(false)
  })

  it('rejects expired timestamps', () => {
    const { header } = signPayload({ secret: SECRET, body: 'x', timestamp: 1000000 })
    const result = verifyPayload({ secret: SECRET, body: 'x', header, toleranceSeconds: 60 })
    expect(result.valid).toBe(false)
    expect(result.reason).toBe('expired')
  })

  it('rejects malformed headers', () => {
    const result = verifyPayload({ secret: SECRET, body: 'x', header: 'garbage' })
    expect(result.valid).toBe(false)
    expect(result.reason).toBe('malformed')
  })

  it('rejects when signature length does not match (length-based side channel)', () => {
    const { header } = signPayload({
      secret: SECRET,
      body: 'x',
      timestamp: Math.floor(Date.now() / 1000),
    })
    // Replace the signature with a shorter one to trigger length-mismatch path
    const badHeader = header.replace(/v1=.*$/, 'v1=abc')
    const result = verifyPayload({ secret: SECRET, body: 'x', header: badHeader })
    expect(result.valid).toBe(false)
  })
})
