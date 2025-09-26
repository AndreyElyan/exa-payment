import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  try {
    console.log('🚀 Starting Payment API...');

    const app = await NestFactory.create(AppModule);

    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    const port = process.env.PORT || 5050;
    await app.listen(port);

    console.log(`✅ Payment API is running on port ${port}`);
    console.log('📡 Available endpoints:');
    console.log('  POST /api/payment - Create payment');
    console.log('  GET  /api/payment/:id - Get payment by ID');
    console.log('  GET  /api/payment - List payments');
    console.log('🚀 Ready to process payments!');
  } catch (error) {
    console.error('❌ Error starting application:', error);
    process.exit(1);
  }
}

bootstrap();
