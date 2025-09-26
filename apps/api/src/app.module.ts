import { Module } from "@nestjs/common";
import { PaymentController } from "./interfaces/controllers/payment.controller";
import { CreatePaymentUseCase } from "./application/use-cases/create-payment.use-case";
import { PrismaService } from "./infra/db/prisma.service";
import { PrismaPaymentRepository } from "./infra/db/prisma-payment.repository";
import { StubPaymentProvider } from "./infra/providers/stub-payment.provider";
import { IdempotencyService } from "./domain/services/idempotency.service";
import { PaymentRepository } from "./application/ports/payment.repository.port";
import { PaymentProvider } from "./application/ports/payment-provider.port";

@Module({
  imports: [],
  controllers: [PaymentController],
  providers: [
    PrismaService,
    {
      provide: "PaymentRepository",
      useClass: PrismaPaymentRepository,
    },
    {
      provide: "PaymentProvider",
      useClass: StubPaymentProvider,
    },
    IdempotencyService,
    CreatePaymentUseCase,
  ],
})
export class AppModule {}
