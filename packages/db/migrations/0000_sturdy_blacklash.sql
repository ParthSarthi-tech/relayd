CREATE TYPE "public"."attempt_status" AS ENUM('success', 'failed', 'timeout', 'connection_error');--> statement-breakpoint
CREATE TYPE "public"."endpoint_status" AS ENUM('active', 'paused', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."message_status" AS ENUM('pending', 'processing', 'delivered', 'failed', 'dead_letter');--> statement-breakpoint
CREATE TYPE "public"."signing_key_status" AS ENUM('active', 'retired');--> statement-breakpoint
CREATE TABLE "attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"message_id" uuid NOT NULL,
	"attempt_number" integer NOT NULL,
	"status" "attempt_status" NOT NULL,
	"http_status" integer,
	"response_body" text,
	"response_headers" jsonb,
	"duration_ms" integer,
	"error_message" text,
	"attempted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"request_url" text NOT NULL,
	"request_headers" jsonb
);
--> statement-breakpoint
CREATE TABLE "endpoints" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"url" text NOT NULL,
	"description" text,
	"secret" text NOT NULL,
	"status" "endpoint_status" DEFAULT 'active' NOT NULL,
	"event_types" text[] DEFAULT '{}' NOT NULL,
	"rate_limit_per_second" integer,
	"rate_limit_burst" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"endpoint_id" uuid NOT NULL,
	"event_id" text NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"status" "message_status" DEFAULT 'pending' NOT NULL,
	"attempt_count" integer DEFAULT 0 NOT NULL,
	"next_retry_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"delivered_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "signing_keys" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"endpoint_id" uuid NOT NULL,
	"kid" text NOT NULL,
	"secret" text,
	"status" "signing_key_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"retired_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "tenants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_message_id_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "endpoints" ADD CONSTRAINT "endpoints_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_endpoint_id_endpoints_id_fk" FOREIGN KEY ("endpoint_id") REFERENCES "public"."endpoints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "signing_keys" ADD CONSTRAINT "signing_keys_endpoint_id_endpoints_id_fk" FOREIGN KEY ("endpoint_id") REFERENCES "public"."endpoints"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "attempts_message_idx" ON "attempts" USING btree ("message_id");--> statement-breakpoint
CREATE UNIQUE INDEX "attempts_message_attempt_idx" ON "attempts" USING btree ("message_id","attempt_number");--> statement-breakpoint
CREATE INDEX "endpoints_tenant_idx" ON "endpoints" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "endpoints_status_idx" ON "endpoints" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "messages_endpoint_event_id_idx" ON "messages" USING btree ("endpoint_id","event_id");--> statement-breakpoint
CREATE INDEX "messages_status_idx" ON "messages" USING btree ("status");--> statement-breakpoint
CREATE INDEX "messages_endpoint_idx" ON "messages" USING btree ("endpoint_id");--> statement-breakpoint
CREATE INDEX "messages_next_retry_idx" ON "messages" USING btree ("next_retry_at");--> statement-breakpoint
CREATE UNIQUE INDEX "signing_keys_endpoint_kid_idx" ON "signing_keys" USING btree ("endpoint_id","kid");--> statement-breakpoint
CREATE INDEX "signing_keys_endpoint_status_idx" ON "signing_keys" USING btree ("endpoint_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "tenants_slug_idx" ON "tenants" USING btree ("slug");