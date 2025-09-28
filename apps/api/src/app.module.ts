import { Module } from "@nestjs/common";
import { PaymentController } from "./interfaces/controllers/payment.controller";
import { WebhookController } from "./interfaces/controllers/webhook.controller";
import { CreatePaymentUseCase } from "./application/use-cases/create-payment.use-case";
import { UpdatePaymentUseCase } from "./application/use-cases/update-payment.use-case";
import { PrismaService } from "./infra/db/prisma.service";
import { PrismaPaymentRepository } from "./infra/db/prisma-payment.repository";
import { StubPaymentProvider } from "./infra/providers/stub-payment.provider";
import { MercadoPagoProvider } from "./infra/providers/mercado-pago.provider";
import { PaymentProviderConfigService } from "./config/payment-provider.config";
import { IdempotencyService } from "./domain/services/idempotency.service";
import { DomainEventService } from "./domain/services/domain-event.service";
import { PaymentRepository } from "./application/ports/payment.repository.port";
import { PaymentProvider } from "./application/ports/payment-provider.port";
import { GlobalExceptionFilter } from "./common/filters/global-exception.filter";
import { TemporalClientService } from "./infra/workflows/temporal-client";
import { TemporalWorkerService } from "./infra/workflows/temporal-worker";
import { PaymentActivitiesImpl } from "./infra/workflows/payment/payment.activities";
import { RabbitMQPublisherService } from "./infra/messaging/rabbitmq-publisher.service";
import { RabbitMQSetupService } from "./infra/messaging/rabbitmq-setup.service";
import {
  TracingService,
  createTracingConfig,
} from "./infra/observability/tracing.config";
import { CustomTracingService } from "./infra/observability/tracing.service";

@Module({
  imports: [],
  controllers: [PaymentController, WebhookController],
  providers: [
    PrismaService,
    {
      provide: "PaymentRepository",
      useClass: PrismaPaymentRepository,
    },
    PaymentProviderConfigService,
    {
      provide: "PaymentProvider",
      useFactory: (configService: PaymentProviderConfigService) => {
        const config = configService.getMercadoPagoConfig();
        return new MercadoPagoProvider(config);
      },
      inject: [PaymentProviderConfigService],
    },
    IdempotencyService,
    RabbitMQSetupService,
    RabbitMQPublisherService,
    DomainEventService,
    TemporalClientService,
    TemporalWorkerService,
    PaymentActivitiesImpl,
    CreatePaymentUseCase,
    UpdatePaymentUseCase,
    GlobalExceptionFilter,
    {
      provide: TracingService,
      useFactory: () => {
        const config = createTracingConfig();
        return new TracingService(config);
      },
    },
    CustomTracingService,
  ],
})
export class AppModule {}
