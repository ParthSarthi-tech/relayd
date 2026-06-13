import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { mockLookup } = vi.hoisted(() => ({
  mockLookup: vi.fn(),
}))

vi.mock('node:dns/promises', () => ({
  lookup: mockLookup,
}))

import { SSRFError, validateUrl } from '../src/ssrf.js'

describe('validateUrl', () => {
  beforeEach(() => {
    mockLookup.mockReset()
    delete process.env.SSRF_ALLOWED_TARGETS
  })

  describe('IP addresses', () => {
    it('blocks 127.0.0.1', async () => {
      await expect(validateUrl('http://127.0.0.1/webhook'))
        .rejects.toThrow(SSRFError)
    })

    it('blocks 10.x.x.x (private range A)', async () => {
      await expect(validateUrl('http://10.0.0.1/webhook'))
        .rejects.toThrow(SSRFError)
    })

    it('blocks 10.255.255.255 (end of range A)', async () => {
      await expect(validateUrl('http://10.255.255.255/webhook'))
        .rejects.toThrow(SSRFError)
    })

    it('blocks 172.16.0.0 (private range B start)', async () => {
      await expect(validateUrl('http://172.16.0.0/webhook'))
        .rejects.toThrow(SSRFError)
    })

    it('blocks 172.31.255.255 (private range B end)', async () => {
      await expect(validateUrl('http://172.31.255.255/webhook'))
        .rejects.toThrow(SSRFError)
    })

    it('allows 172.32.0.0 (not in private range B)', async () => {
      await expect(validateUrl('http://172.32.0.0/webhook'))
        .resolves.toBeUndefined()
    })

    it('blocks 192.168.1.1 (private range C)', async () => {
      await expect(validateUrl('http://192.168.1.1/webhook'))
        .rejects.toThrow(SSRFError)
    })

    it('blocks 169.254.1.1 (link-local)', async () => {
      await expect(validateUrl('http://169.254.1.1/webhook'))
        .rejects.toThrow(SSRFError)
    })

    it('blocks 0.0.0.0', async () => {
      await expect(validateUrl('http://0.0.0.0/webhook'))
        .rejects.toThrow(SSRFError)
    })

    it('allows public IP addresses', async () => {
      await expect(validateUrl('http://93.184.216.34/webhook'))
        .resolves.toBeUndefined()
    })

    it('blocks IPv6 loopback (::1)', async () => {
      await expect(validateUrl('http://[::1]/webhook'))
        .rejects.toThrow(SSRFError)
    })

    it('blocks IPv6 unique local (fc00::)', async () => {
      await expect(validateUrl('http://[fc00::1]/webhook'))
        .rejects.toThrow(SSRFError)
    })

    it('blocks IPv6 link-local (fe80::)', async () => {
      await expect(validateUrl('http://[fe80::1]/webhook'))
        .rejects.toThrow(SSRFError)
    })

    it('allows public IPv6 addresses', async () => {
      await expect(validateUrl('http://[2001:db8::1]/webhook'))
        .resolves.toBeUndefined()
    })
  })

  describe('hostnames', () => {
    it('resolves hostname and blocks if it points to a private IP', async () => {
      mockLookup.mockResolvedValue([{ address: '10.0.0.5', family: 4 }])
      await expect(validateUrl('http://internal.example.com/webhook'))
        .rejects.toThrow(SSRFError)
    })

    it('allows hostname that resolves to a public IP', async () => {
      mockLookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }])
      await expect(validateUrl('http://example.com/webhook'))
        .resolves.toBeUndefined()
    })

    it('blocks if any resolved address is private (multiple A records)', async () => {
      mockLookup.mockResolvedValue([
        { address: '93.184.216.34', family: 4 },
        { address: '192.168.1.1', family: 4 },
      ])
      await expect(validateUrl('http://dual.example.com/webhook'))
        .rejects.toThrow(SSRFError)
    })
  })

  describe('protocol validation', () => {
    it('allows HTTPS', async () => {
      mockLookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }])
      await expect(validateUrl('https://example.com/webhook'))
        .resolves.toBeUndefined()
    })

    it('rejects FTP', async () => {
      await expect(validateUrl('ftp://example.com/webhook'))
        .rejects.toThrow(SSRFError)
    })

    it('rejects file:// protocol', async () => {
      await expect(validateUrl('file:///etc/passwd'))
        .rejects.toThrow(SSRFError)
    })
  })

  describe('SSRF_ALLOWED_TARGETS bypass', () => {
    it('allows hostnames in SSRF_ALLOWED_TARGETS even if they are private', async () => {
      process.env.SSRF_ALLOWED_TARGETS = 'localhost,my-internal.service'
      await expect(validateUrl('http://localhost/webhook'))
        .resolves.toBeUndefined()
      await expect(validateUrl('http://my-internal.service/api'))
        .resolves.toBeUndefined()
    })
  })

  describe('malformed URLs', () => {
    it('rejects empty string', async () => {
      await expect(validateUrl('')).rejects.toThrow()
    })

    it('rejects invalid URLs', async () => {
      await expect(validateUrl('not-a-url')).rejects.toThrow()
    })
  })
})
