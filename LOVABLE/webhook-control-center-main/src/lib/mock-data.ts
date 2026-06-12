export type EndpointStatus = "active" | "paused" | "failing";

export interface Endpoint {
  id: string;
  url: string;
  description: string;
  status: EndpointStatus;
  events: string[];
  lastDelivery: string;
  successRate: number;
  created: string;
}

export const endpoints: Endpoint[] = [
  {
    id: "ep_01HX7N3K2P",
    url: "https://api.acme.io/webhooks/stripe",
    description: "Production billing events",
    status: "active",
    events: ["invoice.paid", "customer.created", "subscription.updated"],
    lastDelivery: "12s ago",
    successRate: 99.94,
    created: "2025-02-14",
  },
  {
    id: "ep_01HX7N3K2Q",
    url: "https://hooks.internal.acme.io/notifications",
    description: "Slack relay for ops team",
    status: "active",
    events: ["incident.created", "incident.resolved"],
    lastDelivery: "1m ago",
    successRate: 100,
    created: "2025-01-08",
  },
  {
    id: "ep_01HX7N3K2R",
    url: "https://staging.acme.io/inbound",
    description: "Staging environment sink",
    status: "failing",
    events: ["*"],
    lastDelivery: "4m ago",
    successRate: 82.1,
    created: "2024-11-22",
  },
  {
    id: "ep_01HX7N3K2S",
    url: "https://api.partners.com/acme/events",
    description: "Partner data sync",
    status: "active",
    events: ["order.created", "order.shipped"],
    lastDelivery: "18s ago",
    successRate: 99.71,
    created: "2025-03-30",
  },
  {
    id: "ep_01HX7N3K2T",
    url: "https://legacy.acme.io/hooks",
    description: "Legacy ERP bridge",
    status: "paused",
    events: ["customer.updated"],
    lastDelivery: "2d ago",
    successRate: 96.3,
    created: "2024-08-02",
  },
  {
    id: "ep_01HX7N3K2U",
    url: "https://analytics.acme.io/ingest",
    description: "Event analytics pipeline",
    status: "active",
    events: ["*"],
    lastDelivery: "3s ago",
    successRate: 99.99,
    created: "2025-04-12",
  },
];

export type MessageStatus = "delivered" | "failed" | "pending" | "retrying";

export interface Message {
  id: string;
  endpoint: string;
  event: string;
  status: MessageStatus;
  code: number;
  duration: number;
  timestamp: string;
  attempts: number;
}

export const messages: Message[] = [
  { id: "msg_2abXq8z4PqL", endpoint: "api.acme.io/webhooks/stripe", event: "invoice.paid", status: "delivered", code: 200, duration: 142, timestamp: "12s ago", attempts: 1 },
  { id: "msg_2abXq8z4PqM", endpoint: "hooks.internal.acme.io/notifications", event: "incident.created", status: "delivered", code: 200, duration: 89, timestamp: "32s ago", attempts: 1 },
  { id: "msg_2abXq8z4PqN", endpoint: "staging.acme.io/inbound", event: "order.created", status: "failed", code: 502, duration: 3021, timestamp: "1m ago", attempts: 3 },
  { id: "msg_2abXq8z4PqO", endpoint: "api.partners.com/acme/events", event: "order.shipped", status: "delivered", code: 200, duration: 211, timestamp: "1m ago", attempts: 1 },
  { id: "msg_2abXq8z4PqP", endpoint: "analytics.acme.io/ingest", event: "user.signed_up", status: "delivered", code: 200, duration: 56, timestamp: "2m ago", attempts: 1 },
  { id: "msg_2abXq8z4PqQ", endpoint: "staging.acme.io/inbound", event: "subscription.updated", status: "retrying", code: 503, duration: 5000, timestamp: "2m ago", attempts: 2 },
  { id: "msg_2abXq8z4PqR", endpoint: "api.acme.io/webhooks/stripe", event: "customer.created", status: "delivered", code: 200, duration: 178, timestamp: "3m ago", attempts: 1 },
  { id: "msg_2abXq8z4PqS", endpoint: "hooks.internal.acme.io/notifications", event: "incident.resolved", status: "delivered", code: 200, duration: 102, timestamp: "4m ago", attempts: 1 },
  { id: "msg_2abXq8z4PqT", endpoint: "analytics.acme.io/ingest", event: "page.viewed", status: "delivered", code: 200, duration: 41, timestamp: "4m ago", attempts: 1 },
  { id: "msg_2abXq8z4PqU", endpoint: "api.partners.com/acme/events", event: "order.created", status: "pending", code: 0, duration: 0, timestamp: "5m ago", attempts: 0 },
  { id: "msg_2abXq8z4PqV", endpoint: "api.acme.io/webhooks/stripe", event: "invoice.payment_failed", status: "delivered", code: 200, duration: 198, timestamp: "5m ago", attempts: 1 },
  { id: "msg_2abXq8z4PqW", endpoint: "staging.acme.io/inbound", event: "customer.updated", status: "failed", code: 500, duration: 2812, timestamp: "6m ago", attempts: 3 },
];

export const samplePayload = {
  id: "evt_3PqL8a2abXq8z4",
  type: "invoice.paid",
  created: 1738291200,
  data: {
    object: {
      id: "in_1PqL8a2abXq8z4",
      amount_paid: 4900,
      currency: "usd",
      customer: "cus_QrT9XmK2vL",
      status: "paid",
      lines: [
        { description: "Pro plan — Monthly", amount: 4900, quantity: 1 },
      ],
    },
  },
};

export const sampleResponse = {
  received: true,
  processed_at: "2025-06-10T14:32:11.482Z",
  request_id: "req_8aN2qLpXm",
};

export const deliveriesSeries = [
  { t: "00:00", success: 1240, failed: 12 },
  { t: "02:00", success: 980, failed: 8 },
  { t: "04:00", success: 760, failed: 4 },
  { t: "06:00", success: 1120, failed: 15 },
  { t: "08:00", success: 2410, failed: 22 },
  { t: "10:00", success: 3180, failed: 31 },
  { t: "12:00", success: 3620, failed: 28 },
  { t: "14:00", success: 4012, failed: 18 },
  { t: "16:00", success: 3840, failed: 24 },
  { t: "18:00", success: 3120, failed: 19 },
  { t: "20:00", success: 2480, failed: 14 },
  { t: "22:00", success: 1890, failed: 9 },
];

export const throughputSeries = deliveriesSeries.map((d) => ({
  t: d.t,
  rps: Math.round((d.success + d.failed) / 60),
}));

export const activity = [
  { id: 1, kind: "endpoint.created", text: "Endpoint api.acme.io/webhooks/stripe created", who: "lena@acme.io", time: "4m ago" },
  { id: 2, kind: "message.delivered", text: "Delivered evt_3PqL8a2abXq8z4 to api.acme.io", who: "system", time: "12m ago" },
  { id: 3, kind: "retry.triggered", text: "Retry #2 scheduled for staging.acme.io/inbound", who: "system", time: "18m ago" },
  { id: 4, kind: "connection.added", text: "Slack connection ops-alerts added", who: "marcus@acme.io", time: "1h ago" },
  { id: 5, kind: "endpoint.disabled", text: "Endpoint legacy.acme.io/hooks paused", who: "lena@acme.io", time: "2h ago" },
  { id: 6, kind: "message.delivered", text: "Delivered evt_3PqL8a2abXq8z3 to analytics.acme.io", who: "system", time: "3h ago" },
];

export const connections = [
  { id: "slack", name: "Slack", description: "Route events to channels with rich formatting.", category: "Messaging", connected: true, events: "12.4k / mo" },
  { id: "discord", name: "Discord", description: "Notify servers via webhooks and bot messages.", category: "Messaging", connected: true, events: "3.1k / mo" },
  { id: "teams", name: "Microsoft Teams", description: "Push events to Teams channels.", category: "Messaging", connected: false, events: "—" },
  { id: "pagerduty", name: "PagerDuty", description: "Trigger and resolve incidents from webhook events.", category: "Incident", connected: true, events: "412 / mo" },
  { id: "datadog", name: "Datadog", description: "Forward delivery metrics and logs.", category: "Observability", connected: false, events: "—" },
  { id: "linear", name: "Linear", description: "Create issues from failed deliveries.", category: "Productivity", connected: false, events: "—" },
  { id: "custom", name: "Custom Webhook", description: "Send to any HTTPS endpoint with custom headers.", category: "Generic", connected: true, events: "84.2k / mo" },
  { id: "s3", name: "Amazon S3", description: "Archive raw event payloads to a bucket.", category: "Storage", connected: false, events: "—" },
];

export const transformations = [
  { id: "tx_1", name: "Stripe → Internal", language: "JavaScript", lastEdited: "2h ago", status: "valid" as const },
  { id: "tx_2", name: "Flatten order payload", language: "JavaScript", lastEdited: "1d ago", status: "valid" as const },
  { id: "tx_3", name: "Redact PII", language: "JavaScript", lastEdited: "3d ago", status: "valid" as const },
  { id: "tx_4", name: "Legacy ERP shape", language: "JavaScript", lastEdited: "1w ago", status: "warning" as const },
];

export const transformationCode = `// Transform incoming Stripe invoice into internal shape
export function handler(input) {
  const obj = input.data.object;
  return {
    event_id: input.id,
    type: input.type,
    customer_id: obj.customer,
    amount_cents: obj.amount_paid,
    currency: obj.currency,
    status: obj.status,
    line_items: obj.lines.map(l => ({
      label: l.description,
      qty: l.quantity,
      amount: l.amount,
    })),
    received_at: new Date(input.created * 1000).toISOString(),
  };
}`;
