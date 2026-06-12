-- Create a trigger function that sends pg_notify on message changes.
-- This powers the SSE live stream without polling.

CREATE OR REPLACE FUNCTION notify_message_change()
RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify(
    'relay_events',
    json_build_object(
      'table', TG_TABLE_NAME,
      'action', TG_OP,
      'id', NEW.id,
      'tenant_id', NEW.tenant_id,
      'endpoint_id', NEW.endpoint_id,
      'event_id', NEW.event_id,
      'event_type', NEW.event_type,
      'status', NEW.status,
      'attempt_count', NEW.attempt_count,
      'last_error', NEW.last_error,
      'created_at', NEW.created_at,
      'updated_at', NEW.updated_at
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS messages_notify_trigger ON messages;
CREATE TRIGGER messages_notify_trigger
AFTER INSERT OR UPDATE ON messages
FOR EACH ROW
EXECUTE FUNCTION notify_message_change();
