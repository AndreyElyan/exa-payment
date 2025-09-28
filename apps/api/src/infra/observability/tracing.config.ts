import { NodeSDK } from "@opentelemetry/sdk-node";
import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { JaegerExporter } from "@opentelemetry/exporter-jaeger";
import { trace, metrics } from "@opentelemetry/api";

export interface TracingConfig {
  serviceName: string;
  serviceVersion: string;
  environment: string;
  jaegerEndpoint?: string;
  jaegerAgentHost?: string;
  jaegerAgentPort?: number;
  enabled: boolean;
}

export class TracingService {
  private sdk?: NodeSDK;
  private readonly config: TracingConfig;

  constructor(config: TracingConfig) {
    this.config = config;
  }

  initialize(): void {
    if (!this.config.enabled) {
      console.log("🔍 Tracing disabled");
      return;
    }

    try {
      process.env.OTEL_SERVICE_NAME = this.config.serviceName;
      process.env.OTEL_SERVICE_VERSION = this.config.serviceVersion;
      process.env.OTEL_RESOURCE_ATTRIBUTES = `service.name=${this.config.serviceName},service.version=${this.config.serviceVersion},deployment.environment=${this.config.environment}`;
      process.env.OTEL_EXPORTER_JAEGER_ENDPOINT =
        this.config.jaegerEndpoint || "http://localhost:14268/api/traces";
      process.env.OTEL_TRACES_EXPORTER = "jaeger";

      const jaegerExporter = new JaegerExporter({
        endpoint: this.config.jaegerEndpoint,
        host: this.config.jaegerAgentHost || "localhost",
        port: this.config.jaegerAgentPort || 14268,
      });

      this.sdk = new NodeSDK({
        traceExporter: jaegerExporter,
        instrumentations: [
          getNodeAutoInstrumentations({
            "@opentelemetry/instrumentation-fs": {
              enabled: false,
            },
            "@opentelemetry/instrumentation-dns": {
              enabled: false,
            },
          }),
        ],
      });

      this.sdk.start();
      console.log("🔍 Jaeger tracing initialized successfully");
      console.log(`📊 Service: ${this.config.serviceName}`);
      console.log(`📊 Version: ${this.config.serviceVersion}`);
      console.log(`📊 Environment: ${this.config.environment}`);
      console.log(`📊 Jaeger Endpoint: ${this.config.jaegerEndpoint}`);
    } catch (error) {
      console.error("❌ Failed to initialize tracing:", error);
    }
  }

  shutdown(): Promise<void> {
    if (this.sdk) {
      return this.sdk.shutdown();
    }
    return Promise.resolve();
  }

  getTracer(name: string, version?: string) {
    return trace.getTracer(name, version);
  }

  getMeter(name: string, version?: string) {
    return metrics.getMeter(name, version);
  }
}

export const createTracingConfig = (): TracingConfig => ({
  serviceName: process.env.SERVICE_NAME || "exa-payment-api",
  serviceVersion: process.env.SERVICE_VERSION || "1.0.0",
  environment: process.env.NODE_ENV || "development",
  jaegerEndpoint: process.env.JAEGER_ENDPOINT,
  jaegerAgentHost: process.env.JAEGER_AGENT_HOST || "localhost",
  jaegerAgentPort: parseInt(process.env.JAEGER_AGENT_PORT || "14268"),
  enabled: process.env.TRACING_ENABLED === "true",
});
