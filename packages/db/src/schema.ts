import { relations } from 'drizzle-orm'
import {
  type AnyPgColumn,
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'

// ============================================
// Enums
// ============================================

export const endpointStatusEnum = pgEnum('endpoint_status', ['active', 'paused', 'disabled'])

export const signingKeyStatusEnum = pgEnum('signing_key_status', ['active', 'retired'])

export const messageStatusEnum = pgEnum('message_status', [
  'pending',
  'processing',
  'delivered',
  'failed',
  'dead_letter',
])

export const attemptStatusEnum = pgEnum('attempt_status', [
  'success',
  'failed',
  'timeout',
  'connection_error',
])

export const userRoleEnum = pgEnum('user_role', ['admin', 'member'])

// ============================================
// Tenants
// ============================================

export const tenants = pgTable(
  'tenants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    slugIdx: uniqueIndex('tenants_slug_idx').on(table.slug),
  }),
)

// ============================================
// Endpoints
// ============================================

export const endpoints = pgTable(
  'endpoints',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    url: text('url').notNull(),
    description: text('description'),
    // Current active secret. Plain text — encryption-at-rest handled by DB.
    secret: text('secret').notNull(),
    status: endpointStatusEnum('status').notNull().default('active'),
    // Empty array = subscribe to all event types. Otherwise filter.
    eventTypes: text('event_types').array().notNull().default([]),
    // Per-endpoint rate limit override. null = use global default.
    rateLimitPerSecond: integer('rate_limit_per_second'),
    rateLimitBurst: integer('rate_limit_burst'),
    // Per-endpoint delivery timeout override (ms). null = use global default.
    timeoutMs: integer('timeout_ms'),
    // Optional URL that receives a POST when a message is dead-lettered.
    deadLetterWebhookUrl: text('dead_letter_webhook_url'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => ({
    tenantIdx: index('endpoints_tenant_idx').on(table.tenantId),
    statusIdx: index('endpoints_status_idx').on(table.status),
  }),
)

// ============================================
// Signing Keys (versioned, supports rotation)
// ============================================

export const signingKeys = pgTable(
  'signing_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    endpointId: uuid('endpoint_id')
      .notNull()
      .references(() => endpoints.id, { onDelete: 'cascade' }),
    // Key ID — exposed in X-Relay-Signature header as kid parameter
    kid: text('kid').notNull(),
    // We store the actual secret here for the active key (workers need to sign).
    // Retired keys are nulled out (verification only).
    secret: text('secret'),
    status: signingKeyStatusEnum('status').notNull().default('active'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    retiredAt: timestamp('retired_at', { withTimezone: true }),
  },
  (table) => ({
    endpointKidIdx: uniqueIndex('signing_keys_endpoint_kid_idx').on(table.endpointId, table.kid),
    endpointStatusIdx: index('signing_keys_endpoint_status_idx').on(table.endpointId, table.status),
  }),
)

// ============================================
// Messages (events to be delivered)
// ============================================

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    endpointId: uuid('endpoint_id')
      .notNull()
      .references(() => endpoints.id, { onDelete: 'cascade' }),
    // Customer-provided idempotency key. Unique per endpoint.
    eventId: text('event_id').notNull(),
    eventType: text('event_type').notNull(),
    payload: jsonb('payload').notNull(),
    status: messageStatusEnum('status').notNull().default('pending'),
    attemptCount: integer('attempt_count').notNull().default(0),
    nextRetryAt: timestamp('next_retry_at', { withTimezone: true }),
    lastError: text('last_error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    deliveredAt: timestamp('delivered_at', { withTimezone: true }),
  },
  (table) => ({
    endpointEventIdIdx: uniqueIndex('messages_endpoint_event_id_idx').on(
      table.endpointId,
      table.eventId,
    ),
    statusIdx: index('messages_status_idx').on(table.status),
    endpointIdx: index('messages_endpoint_idx').on(table.endpointId),
    nextRetryIdx: index('messages_next_retry_idx').on(table.nextRetryAt),
  }),
)

// ============================================
// Attempts (delivery history per message)
// ============================================

export const attempts = pgTable(
  'attempts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    messageId: uuid('message_id')
      .notNull()
      .references((): AnyPgColumn => messages.id, { onDelete: 'cascade' }),
    attemptNumber: integer('attempt_number').notNull(),
    status: attemptStatusEnum('status').notNull(),
    httpStatus: integer('http_status'),
    responseBody: text('response_body'),
    responseHeaders: jsonb('response_headers'),
    durationMs: integer('duration_ms'),
    errorMessage: text('error_message'),
    attemptedAt: timestamp('attempted_at', { withTimezone: true }).notNull().defaultNow(),
    requestUrl: text('request_url').notNull(),
    requestHeaders: jsonb('request_headers'),
    requestId: text('request_id'),
  },
  (table) => ({
    messageIdx: index('attempts_message_idx').on(table.messageId),
    messageAttemptIdx: uniqueIndex('attempts_message_attempt_idx').on(
      table.messageId,
      table.attemptNumber,
    ),
  }),
)

// ============================================
// Audit Logs
// ============================================

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    endpointId: uuid('endpoint_id').references(() => endpoints.id, {
      onDelete: 'set null',
    }),
    action: text('action').notNull(),
    metadata: jsonb('metadata'),
    ip: text('ip'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantActionIdx: index('audit_logs_tenant_action_idx').on(table.tenantId, table.action),
    createdAtIdx: index('audit_logs_created_at_idx').on(table.createdAt),
  }),
)

// ============================================
// Users
// ============================================

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    name: text('name').notNull(),
    role: userRoleEnum('role').notNull().default('member'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    emailIdx: uniqueIndex('users_email_idx').on(table.email),
    tenantIdx: index('users_tenant_idx').on(table.tenantId),
  }),
)

// ============================================
// Transformations (JS payload pipelines)
// ============================================

export const transformations = pgTable(
  'transformations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    // JavaScript function body. Receives (payload, headers) and returns { payload, headers }.
    code: text('code').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index('transformations_tenant_idx').on(table.tenantId),
  }),
)

// ============================================
// Connections (event-type routing rules)
// ============================================

export const connections = pgTable(
  'connections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    endpointId: uuid('endpoint_id')
      .notNull()
      .references(() => endpoints.id, { onDelete: 'cascade' }),
    transformationId: uuid('transformation_id').references(() => transformations.id, {
      onDelete: 'set null',
    }),
    // JSON filter rules: { conditions: [{ field, op, value }] }
    filterRules: jsonb('filter_rules'),
    enabled: boolean('enabled').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    tenantIdx: index('connections_tenant_idx').on(table.tenantId),
    endpointIdx: index('connections_endpoint_idx').on(table.endpointId),
  }),
)

export type AuditLog = typeof auditLogs.$inferSelect
export type NewAuditLog = typeof auditLogs.$inferInsert

// ============================================
// Relations
// ============================================

export const tenantsRelations = relations(tenants, ({ many }) => ({
  endpoints: many(endpoints),
  messages: many(messages),
}))

export const endpointsRelations = relations(endpoints, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [endpoints.tenantId],
    references: [tenants.id],
  }),
  signingKeys: many(signingKeys),
  messages: many(messages),
}))

export const signingKeysRelations = relations(signingKeys, ({ one }) => ({
  endpoint: one(endpoints, {
    fields: [signingKeys.endpointId],
    references: [endpoints.id],
  }),
}))

export const messagesRelations = relations(messages, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [messages.tenantId],
    references: [tenants.id],
  }),
  endpoint: one(endpoints, {
    fields: [messages.endpointId],
    references: [endpoints.id],
  }),
  attempts: many(attempts),
}))

export const attemptsRelations = relations(attempts, ({ one }) => ({
  message: one(messages, {
    fields: [attempts.messageId],
    references: [messages.id],
  }),
}))

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  tenant: one(tenants, {
    fields: [auditLogs.tenantId],
    references: [tenants.id],
  }),
  endpoint: one(endpoints, {
    fields: [auditLogs.endpointId],
    references: [endpoints.id],
  }),
}))

export const usersRelations = relations(users, ({ one }) => ({
  tenant: one(tenants, {
    fields: [users.tenantId],
    references: [tenants.id],
  }),
}))

export const transformationsRelations = relations(transformations, ({ one }) => ({
  tenant: one(tenants, {
    fields: [transformations.tenantId],
    references: [tenants.id],
  }),
}))

export const connectionsRelations = relations(connections, ({ one }) => ({
  tenant: one(tenants, {
    fields: [connections.tenantId],
    references: [tenants.id],
  }),
  endpoint: one(endpoints, {
    fields: [connections.endpointId],
    references: [endpoints.id],
  }),
  transformation: one(transformations, {
    fields: [connections.transformationId],
    references: [transformations.id],
  }),
}))

// ============================================
// API Keys (for programmatic API access)
// ============================================

export const apiKeyScopeEnum = pgEnum('api_key_scope', [
  'events:write',
  'events:read',
  'endpoints:write',
  'endpoints:read',
  'keys:write',
  'keys:read',
  'transformations:write',
  'transformations:read',
  'connections:write',
  'connections:read',
  'messages:read',
  'messages:write',
  'stats:read',
  'admin',
])

export const apiKeys = pgTable(
  'api_keys',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // Human-readable label (e.g. "CI/CD", "Production")
    name: text('name').notNull(),
    // First 12 chars of the key for display ("rel_" + 8 chars)
    keyPrefix: text('key_prefix').notNull(),
    // SHA-256 digest of the full key — used for fast lookup
    keyDigest: text('key_digest').notNull(),
    // Comma-separated scope string (e.g. "events:write,endpoints:read")
    scopes: text('scopes').notNull().default(''),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    keyDigestIdx: uniqueIndex('api_keys_key_digest_idx').on(table.keyDigest),
    tenantIdx: index('api_keys_tenant_idx').on(table.tenantId),
    tenantActiveIdx: index('api_keys_tenant_active_idx').on(table.tenantId, table.active),
  }),
)

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  tenant: one(tenants, {
    fields: [apiKeys.tenantId],
    references: [tenants.id],
  }),
  user: one(users, {
    fields: [apiKeys.userId],
    references: [users.id],
  }),
}))

// ============================================
// Inferred Types
// ============================================

export type Tenant = typeof tenants.$inferSelect
export type NewTenant = typeof tenants.$inferInsert
export type Endpoint = typeof endpoints.$inferSelect
export type NewEndpoint = typeof endpoints.$inferInsert
export type SigningKey = typeof signingKeys.$inferSelect
export type NewSigningKey = typeof signingKeys.$inferInsert
export type Message = typeof messages.$inferSelect
export type NewMessage = typeof messages.$inferInsert
export type Attempt = typeof attempts.$inferSelect
export type NewAttempt = typeof attempts.$inferInsert

export type EndpointStatus = (typeof endpointStatusEnum.enumValues)[number]
export type MessageStatus = (typeof messageStatusEnum.enumValues)[number]
export type AttemptStatus = (typeof attemptStatusEnum.enumValues)[number]
export type SigningKeyStatus = (typeof signingKeyStatusEnum.enumValues)[number]
export type UserRole = (typeof userRoleEnum.enumValues)[number]
export type ApiKeyScope = (typeof apiKeyScopeEnum.enumValues)[number]

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Transformation = typeof transformations.$inferSelect
export type NewTransformation = typeof transformations.$inferInsert
export type Connection = typeof connections.$inferSelect
export type NewConnection = typeof connections.$inferInsert
export type ApiKey = typeof apiKeys.$inferSelect
export type NewApiKey = typeof apiKeys.$inferInsert
