import { Injectable, Logger } from "@nestjs/common";
import {
  trace,
  SpanKind,
  SpanStatusCode,
  context,
  Span,
} from "@opentelemetry/api";
import { TracingService } from "./tracing.config";

@Injectable()
export class CustomTracingService {
  private readonly logger = new Logger(CustomTracingService.name);
  private readonly tracer = trace.getTracer("exa-payment-custom");

  constructor(private readonly tracingService: TracingService) {}

  async traceUseCase<T>(
    useCaseName: string,
    operation: string,
    fn: () => Promise<T>,
    attributes?: Record<string, any>,
  ): Promise<T> {
    const span = this.tracer.startSpan(`${useCaseName}.${operation}`, {
      kind: SpanKind.INTERNAL,
      attributes: {
        "use_case.name": useCaseName,
        "use_case.operation": operation,
        ...attributes,
      },
    });

    try {
      const result = await context.with(
        trace.setSpan(context.active(), span),
        fn,
      );
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
      span.recordException(error);
      throw error;
    } finally {
      span.end();
    }
  }

  async traceProvider<T>(
    providerName: string,
    operation: string,
    fn: () => Promise<T>,
    attributes?: Record<string, any>,
  ): Promise<T> {
    const span = this.tracer.startSpan(`${providerName}.${operation}`, {
      kind: SpanKind.CLIENT,
      attributes: {
        "provider.name": providerName,
        "provider.operation": operation,
        ...attributes,
      },
    });

    try {
      const result = await context.with(
        trace.setSpan(context.active(), span),
        fn,
      );
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
      span.recordException(error);
      throw error;
    } finally {
      span.end();
    }
  }

  async traceDatabase<T>(
    operation: string,
    table: string,
    fn: () => Promise<T>,
    attributes?: Record<string, any>,
  ): Promise<T> {
    const span = this.tracer.startSpan(`database.${operation}`, {
      kind: SpanKind.CLIENT,
      attributes: {
        "db.operation": operation,
        "db.table": table,
        "db.system": "postgresql",
        ...attributes,
      },
    });

    try {
      const result = await context.with(
        trace.setSpan(context.active(), span),
        fn,
      );
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
      span.recordException(error);
      throw error;
    } finally {
      span.end();
    }
  }

  async traceMessaging<T>(
    operation: string,
    queue: string,
    fn: () => Promise<T>,
    attributes?: Record<string, any>,
  ): Promise<T> {
    const span = this.tracer.startSpan(`messaging.${operation}`, {
      kind: SpanKind.PRODUCER,
      attributes: {
        "messaging.operation": operation,
        "messaging.queue": queue,
        "messaging.system": "rabbitmq",
        ...attributes,
      },
    });

    try {
      const result = await context.with(
        trace.setSpan(context.active(), span),
        fn,
      );
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
      span.recordException(error);
      throw error;
    } finally {
      span.end();
    }
  }

  async traceWorkflow<T>(
    workflowName: string,
    operation: string,
    fn: () => Promise<T>,
    attributes?: Record<string, any>,
  ): Promise<T> {
    const span = this.tracer.startSpan(
      `workflow.${workflowName}.${operation}`,
      {
        kind: SpanKind.INTERNAL,
        attributes: {
          "workflow.name": workflowName,
          "workflow.operation": operation,
          "workflow.system": "temporal",
          ...attributes,
        },
      },
    );

    try {
      const result = await context.with(
        trace.setSpan(context.active(), span),
        fn,
      );
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error.message,
      });
      span.recordException(error);
      throw error;
    } finally {
      span.end();
    }
  }

  addSpanAttributes(attributes: Record<string, any>): void {
    const span = trace.getActiveSpan();
    if (span) {
      span.setAttributes(attributes);
    }
  }

  addSpanEvent(name: string, attributes?: Record<string, any>): void {
    const span = trace.getActiveSpan();
    if (span) {
      span.addEvent(name, attributes);
    }
  }

  getCurrentSpan(): Span | undefined {
    return trace.getActiveSpan();
  }
}
