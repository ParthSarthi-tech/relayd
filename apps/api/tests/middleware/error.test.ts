import { Hono } from 'hono'
import { describe, expect, it, vi } from 'vitest'
import {
  BadRequestError,
  NotFoundError,
  TooManyRequestsError,
  UnprocessableEntityError,
} from '../../src/lib/errors.js'
import type { Logger } from '../../src/lib/logger.js'
import { errorHandler } from '../../src/middleware/error.js'

function silentLogger(): Logger {
  const log = vi.fn() as unknown as Logger
  log.info = vi.fn()
  log.warn = vi.fn()
  log.error = vi.fn()
  log.debug = vi.fn()
  log.fatal = vi.fn()
  log.trace = vi.fn()
  log.silent = vi.fn()
  log.child = vi.fn().mockReturnThis()
  log.level = 'silent'
  return log
}

describe('errorHandler', () => {
  it('returns 404 JSON for NotFoundError', async () => {
    const app = new Hono()
    app.get('/test', () => {
      throw new NotFoundError('Resource not found')
    })
    app.onError(errorHandler(silentLogger()))

    const res = await app.request('/test')
    expect(res.status).toBe(404)
    const body = await res.json()
    expect(body.error.code).toBe('not_found')
    expect(body.error.message).toBe('Resource not found')
  })

  it('returns 429 with Retry-After header for TooManyRequestsError', async () => {
    const app = new Hono()
    app.get('/test', () => {
      throw new TooManyRequestsError('Slow down', 5)
    })
    app.onError(errorHandler(silentLogger()))

    const res = await app.request('/test')
    expect(res.status).toBe(429)
    expect(res.headers.get('Retry-After')).toBe('5')
    const body = await res.json()
    expect(body.error.code).toBe('rate_limited')
  })

  it('returns 422 for UnprocessableEntityError', async () => {
    const app = new Hono()
    app.get('/test', () => {
      throw new UnprocessableEntityError('Invalid state')
    })
    app.onError(errorHandler(silentLogger()))

    const res = await app.request('/test')
    expect(res.status).toBe(422)
    const body = await res.json()
    expect(body.error.code).toBe('unprocessable_entity')
  })

  it('returns 400 for BadRequestError', async () => {
    const app = new Hono()
    app.get('/test', () => {
      throw new BadRequestError('Bad input')
    })
    app.onError(errorHandler(silentLogger()))

    const res = await app.request('/test')
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error.code).toBe('bad_request')
  })

  it('returns 500 for unexpected errors', async () => {
    const app = new Hono()
    app.get('/test', () => {
      throw new Error('Something broke')
    })
    app.onError(errorHandler(silentLogger()))

    const res = await app.request('/test')
    expect(res.status).toBe(500)
    const body = await res.json()
    expect(body.error.code).toBe('internal_error')
  })

  it('includes error details when present', async () => {
    const app = new Hono()
    app.get('/test', () => {
      throw new BadRequestError('Validation failed', {
        field: 'email',
        reason: 'invalid_format',
      })
    })
    app.onError(errorHandler(silentLogger()))

    const res = await app.request('/test')
    const body = await res.json()
    expect(body.error.details).toEqual({
      field: 'email',
      reason: 'invalid_format',
    })
  })
})
