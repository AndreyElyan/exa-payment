import { NestFactory } from "@nestjs/core";
import { ValidationPipe, BadRequestException } from "@nestjs/common";
import { AppModule } from "./app.module";
import { GlobalExceptionFilter } from "./common/filters/global-exception.filter";

async function bootstrap() {
  try {
    console.log("🚀 Starting Payment API...");

    const app = await NestFactory.create(AppModule);

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

    const port = process.env.PORT || 5050;
    await app.listen(port);

    console.log(`✅ Payment API is running on port ${port}`);
    console.log("📡 Available endpoints:");
    console.log("  POST /api/payment - Create payment");
    console.log("  PUT  /api/payment/:id - Update payment");
    console.log("  GET  /api/payment/:id - Get payment by ID");
    console.log("  GET  /api/payment - List payments");

    console.log(`💳 Payment Provider: Mercado Pago`);
    console.log("🔗 Mercado Pago integration enabled");
    console.log(
      "🌐 Using official Mercado Pago API: https://api.mercadopago.com/checkout/preferences",
    );

    console.log("⚡ Temporal Workflow enabled for CREDIT_CARD payments");
    console.log("🔄 Robust payment processing with retries and durability");
    console.log("🎛️ Temporal UI available at: http://localhost:8080");

    console.log("🚀 Ready to process payments with Temporal Workflows!");
  } catch (error) {
    console.error("❌ Error starting application:", error);
    process.exit(1);
  }
}

bootstrap();
