import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

const PRIVATE_RANGES = [
  { start: ipToBigInt('10.0.0.0'), end: ipToBigInt('10.255.255.255') },
  { start: ipToBigInt('127.0.0.0'), end: ipToBigInt('127.255.255.255') },
  { start: ipToBigInt('169.254.0.0'), end: ipToBigInt('169.254.255.255') },
  { start: ipToBigInt('172.16.0.0'), end: ipToBigInt('172.31.255.255') },
  { start: ipToBigInt('192.168.0.0'), end: ipToBigInt('192.168.255.255') },
  { start: ipToBigInt('0.0.0.0'), end: ipToBigInt('0.255.255.255') },
]

function ipToBigInt(ip: string): bigint {
  const parts = ip.split('.').map((s) => Number(s))
  return ((BigInt(parts[0]!) << 24n) | (BigInt(parts[1]!) << 16n) | (BigInt(parts[2]!) << 8n) | BigInt(parts[3]!))
}

function isPrivateIPv4(ip: string): boolean {
  if (isIP(ip) !== 4) return false
  const addr = ipToBigInt(ip)
  return PRIVATE_RANGES.some((range) => addr >= range.start && addr <= range.end)
}

function isPrivateIPv6(ip: string): boolean {
  if (isIP(ip) !== 6) return false
  const lower = ip.toLowerCase()
  if (lower === '::1' || lower === '0:0:0:0:0:0:0:1') return true
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true
  if (lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) return true
  return false
}

function isPrivateIP(ip: string): boolean {
  return isPrivateIPv4(ip) || isPrivateIPv6(ip)
}

export class SSRFError extends Error {
  constructor(url: string, ip: string) {
    super(`SSRF blocked: ${url} resolves to private IP ${ip}`)
    this.name = 'SSRFError'
  }
}

export async function validateUrl(url: string): Promise<void> {
  const parsed = new URL(url)

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new SSRFError(url, `unexpected protocol ${parsed.protocol}`)
  }

  const hostname = parsed.hostname

  if (isIP(hostname)) {
    if (isPrivateIP(hostname)) {
      throw new SSRFError(url, hostname)
    }
    return
  }

  const addresses = await lookup(hostname, { all: true })
  for (const entry of addresses) {
    if (isPrivateIP(entry.address)) {
      throw new SSRFError(url, entry.address)
    }
  }
}
