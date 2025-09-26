import { Module } from "@nestjs/common";
import { PaymentController } from "./interfaces/controllers/payment.controller";
import { CreatePaymentUseCase } from "./application/use-cases/create-payment.use-case";
import { UpdatePaymentUseCase } from "./application/use-cases/update-payment.use-case";
import { PrismaService } from "./infra/db/prisma.service";
import { PrismaPaymentRepository } from "./infra/db/prisma-payment.repository";
import { StubPaymentProvider } from "./infra/providers/stub-payment.provider";
import { IdempotencyService } from "./domain/services/idempotency.service";
import { DomainEventService } from "./domain/services/domain-event.service";
import { PaymentRepository } from "./application/ports/payment.repository.port";
import { PaymentProvider } from "./application/ports/payment-provider.port";
import { GlobalExceptionFilter } from "./common/filters/global-exception.filter";

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
    DomainEventService,
    CreatePaymentUseCase,
    UpdatePaymentUseCase,
    GlobalExceptionFilter,
  ],
})
export class AppModule {}
