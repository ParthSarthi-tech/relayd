import { randomString } from 'https://jslib.k6.io/k6-utils/1.4.0/index.js'
import { check, sleep } from 'k6'
import http from 'k6/http'

const API_BASE = __ENV.API_BASE ?? 'http://localhost:3000'
const TARGET_URL = __ENV.TARGET_URL ?? 'http://localhost:3001'

// Simulate 100 distinct endpoints receiving events
const ENDPOINT_COUNT = 100
const ENDPOINT_IDS = Array.from({ length: ENDPOINT_COUNT }, (_, i) => `endpoint-${i}`)

export const options = {
  stages: [
    { duration: '30s', target: 50 }, // ramp up to 50 VUs
    { duration: '1m', target: 100 }, // ramp to 100 VUs
    { duration: '2m', target: 200 }, // sustain at 200 VUs
    { duration: '30s', target: 0 }, // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<2000'],
    http_req_failed: ['rate<0.01'],
  },
}

export function setup() {
  // Create endpoints to send events to
  const endpoints = []
  for (let i = 0; i < ENDPOINT_COUNT; i++) {
    const res = http.post(
      `${API_BASE}/v1/endpoints`,
      JSON.stringify({
        url: TARGET_URL,
        description: `Load test endpoint ${i}`,
        eventTypes: ['loadtest.event'],
        rateLimitPerSecond: 1000,
        rateLimitBurst: 2000,
      }),
      { headers: { 'Content-Type': 'application/json' } },
    )

    if (res.status === 201) {
      endpoints.push(JSON.parse(res.body))
    }
  }
  console.log(`Created ${endpoints.length} endpoints`)
  return { endpoints }
}

export default function (data) {
  const endpoints = data.endpoints
  if (endpoints.length === 0) {
    console.error('No endpoints available')
    return
  }

  const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)]

  const payload = JSON.stringify({
    endpointId: endpoint.id,
    eventId: `evt_${randomString(16)}`,
    eventType: 'loadtest.event',
    payload: {
      timestamp: Date.now(),
      value: Math.random(),
      message: 'Load test event',
    },
  })

  const res = http.post(`${API_BASE}/v1/events`, payload, {
    headers: { 'Content-Type': 'application/json' },
  })

  check(res, {
    'status is 200 or 201': (r) => r.status === 200 || r.status === 201,
    'response has id': (r) => JSON.parse(r.body).id !== undefined,
  })

  if (res.status !== 200 && res.status !== 201) {
    console.warn(`Unexpected status ${res.status}: ${res.body}`)
  }

  sleep(Math.random() * 0.1) // 0-100ms between requests
}
