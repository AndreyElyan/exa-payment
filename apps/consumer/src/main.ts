import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { Logger } from "@nestjs/common";

async function bootstrap() {
  const logger = new Logger("ConsumerApp");

  try {
    logger.log("🚀 Starting Payment Event Consumer...");

    const app = await NestFactory.create(AppModule);

    app.enableShutdownHooks();

    const port = process.env.CONSUMER_PORT || 5051;
    console.log(`🔧 Attempting to listen on port ${port}...`);

    await app.listen(port);

    logger.log("✅ Payment Event Consumer started successfully");
    logger.log(`📡 Consumer ready to process events on port ${port}`);

    setInterval(() => {
      logger.log("🔄 Consumer is running and ready to process events...");
    }, 30000);

    process.on("SIGTERM", async () => {
      logger.log("🛑 Shutting down gracefully...");
      await app.close();
      process.exit(0);
    });

    process.on("SIGINT", async () => {
      logger.log("🛑 Shutting down gracefully...");
      await app.close();
      process.exit(0);
    });
  } catch (error) {
    logger.error("❌ Failed to start Consumer App", error);
    process.exit(1);
  }
}

bootstrap();
