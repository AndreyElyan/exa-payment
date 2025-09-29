import { NestFactory } from "@nestjs/core";
import { ValidationPipe, BadRequestException } from "@nestjs/common";
import { AppModule } from "./app.module";
import { TemporalWorkerService } from "./infra/workflows/temporal-worker";
import { GlobalExceptionFilter } from "./common/filters/global-exception.filter";
import {
  TracingService,
  createTracingConfig,
} from "./infra/observability/tracing.config";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";

async function bootstrap() {
  let app: any;
  let worker: any;

  const gracefulShutdown = async (signal: string) => {
    console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);

    try {
      if (worker) {
        console.log("🔄 Shutting down Temporal Worker...");
        await worker.onModuleDestroy();
      }

      if (app) {
        console.log("🔄 Shutting down NestJS application...");
        await app.close();
      }

      console.log("✅ Graceful shutdown completed");
      process.exit(0);
    } catch (error) {
      console.error("❌ Error during graceful shutdown:", error);
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
  process.on("SIGUSR2", () => gracefulShutdown("SIGUSR2"));

  try {
    console.log("🚀 Starting Payment API...");

    const port = parseInt(process.env.PORT || "5050", 10);
    const tracingConfig = createTracingConfig();
    const tracingService = new TracingService(tracingConfig);
    tracingService.initialize();

    app = await NestFactory.create(AppModule);

    app.useGlobalFilters(new GlobalExceptionFilter());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        exceptionFactory: (errors) => {
          const errorMessages = errors.map((error) => {
            const constraints = Object.values(error.constraints || {});
            return constraints.join(", ");
          });
          return new BadRequestException(errorMessages.join("; "));
        },
      }),
    );

    const config = new DocumentBuilder()
      .setTitle("Exa Payment API")
      .setDescription(
        "Sistema de pagamentos com Clean Architecture, Temporal Workflows e observabilidade",
      )
      .setVersion("1.0.0")
      .addTag("payments", "Operações de pagamento")
      .addTag("webhooks", "Webhooks do Mercado Pago")
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup("api/docs", app, document, {
      customSiteTitle: "Exa Payment API Documentation",
      customfavIcon: "https://nestjs.com/img/logo-small.svg",
      customJs: [
        "https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui-bundle.min.js",
        "https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui-standalone-preset.min.js",
      ],
      customCssUrl: [
        "https://cdnjs.cloudflare.com/ajax/libs/swagger-ui/4.15.5/swagger-ui.min.css",
      ],
    });

    console.log(`🔧 Attempting to listen on port ${port}...`);

    await app.listen(port);

    worker = app.get(TemporalWorkerService);
    await worker.start();

    app.enableShutdownHooks();

    console.log(`✅ Payment API is running on port ${port}`);

    console.log("📚 API Documentation:");
    console.log(`http://localhost:5050/api/docs - Swagger UI Documentation`);

    console.log("🔗 Mercado Pago integration enabled");
    console.log(
      "🌐 Using official Mercado Pago API: https://api.mercadopago.com/checkout/preferences",
    );
    console.log("🎛️ Temporal UI available at: http://localhost:8080");

    console.log("🚀 Ready to process payments with Temporal Workflows!");

    if (tracingConfig.enabled) {
      console.log(`📊 Jaeger UI: http://localhost:16686`);
    }
  } catch (error) {
    console.error("❌ Error starting application:", error);
    await gracefulShutdown("ERROR");
  }
}

bootstrap();
