import { createServer } from 'node:http'

const PORT = 3001
let received = 0

const server = createServer((req, res) => {
  let body = ''
  req.on('data', (chunk) => (body += chunk))
  req.on('end', () => {
    received++
    const signature = req.headers['x-relay-signature']
    const messageId = req.headers['x-relay-message-id']
    const eventType = req.headers['x-relay-event-type']
    const attempt = req.headers['x-relay-attempt']
    console.log(
      `\n[receiver] #${received} ${req.method} ${req.url}`,
      `\n  message-id: ${messageId}`,
      `\n  event-type: ${eventType}`,
      `\n  attempt:    ${attempt}`,
      `\n  signature:  ${signature}`,
      `\n  body:       ${body}`,
    )
    res.writeHead(200, { 'content-type': 'application/json' })
    res.end(JSON.stringify({ received: true, n: received }))
  })
})

server.listen(PORT, () => {
  console.log(`[receiver] Listening on http://localhost:${PORT}`)
  console.log(`[receiver] Ready to accept signed webhook deliveries`)
})
