import { DiagConsoleLogger, DiagLogLevel, diag } from '@opentelemetry/api'

/**
 * Initialize OpenTelemetry if OTEL_EXPORTER_OTLP_ENDPOINT is configured.
 * Call this at process start before any application code.
 * Returns a shutdown function for graceful cleanup.
 */
export async function initTelemetry(serviceName: string): Promise<() => void> {
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT
  if (!endpoint) {
    return () => {}
  }

  diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.WARN)

  const { NodeSDK } = await import('@opentelemetry/sdk-node')
  const { getNodeAutoInstrumentations } = await import('@opentelemetry/auto-instrumentations-node')
  const { OTLPTraceExporter } = await import('@opentelemetry/exporter-trace-otlp-proto')

  const sdk = new NodeSDK({
    serviceName,
    traceExporter: new OTLPTraceExporter({ url: endpoint }),
    instrumentations: [getNodeAutoInstrumentations()],
  })

  await sdk.start()
  return () => sdk.shutdown().catch(() => {})
}
