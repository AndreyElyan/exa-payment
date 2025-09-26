import { NestFactory } from "@nestjs/core";
import { ValidationPipe, BadRequestException } from "@nestjs/common";
import { AppModule } from "./app.module";
import { GlobalExceptionFilter } from "./common/filters/global-exception.filter";

async function bootstrap() {
  try {
    console.log("🚀 Starting Payment API...");

    const app = await NestFactory.create(AppModule);

    // Global exception filter
    app.useGlobalFilters(new GlobalExceptionFilter());

    // Global validation pipe
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
    console.log("  GET  /api/payment/:id - Get payment by ID");
    console.log("  GET  /api/payment - List payments");
    console.log("🚀 Ready to process payments!");
  } catch (error) {
    console.error("❌ Error starting application:", error);
    process.exit(1);
  }
}

bootstrap();
