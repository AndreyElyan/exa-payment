import {
  Injectable,
  BadRequestException,
  ConflictException,
  Inject,
  ServiceUnavailableException,
  Logger,
} from "@nestjs/common";
import { Payment, PaymentMethod } from "../../domain/entities/payment.entity";
import { Cpf } from "../../domain/value-objects/cpf.vo";
import { IdempotencyService } from "../../domain/services/idempotency.service";
import { PaymentRepository } from "../ports/payment.repository.port";
import { PaymentProvider } from "../ports/payment-provider.port";
import { CreatePaymentDto } from "../../interfaces/dto/create-payment.dto";
import { TemporalClientService } from "../../infra/workflows/temporal-client";
import { DomainEventService } from "../../domain/services/domain-event.service";
import { CustomTracingService } from "../../infra/observability/tracing.service";

export interface CreatePaymentInput {
  dto: CreatePaymentDto;
  idempotencyKey?: string;
}

export interface CreatePaymentOutput {
  payment: Payment;
  isNew: boolean;
}

@Injectable()
export class CreatePaymentUseCase {
  private readonly logger = new Logger(CreatePaymentUseCase.name);

  constructor(
    @Inject("PaymentRepository")
    private readonly paymentRepository: PaymentRepository,
    @Inject("PaymentProvider")
    private readonly paymentProvider: PaymentProvider,
    @Inject(IdempotencyService)
    private readonly idempotencyService: IdempotencyService,
    private readonly temporalClient: TemporalClientService,
    private readonly domainEventService: DomainEventService,
    private readonly tracingService: CustomTracingService,
  ) {}

  async execute(input: CreatePaymentInput): Promise<CreatePaymentOutput> {
    const { dto, idempotencyKey } = input;

    return this.tracingService.traceUseCase(
      "CreatePaymentUseCase",
      "execute",
      async () => {
        return this.executeInternal(dto, idempotencyKey);
      },
      {
        "payment.method": dto.paymentMethod,
        "payment.amount": dto.amount,
        "payment.cpf": dto.cpf,
        "idempotency.key": idempotencyKey || "none",
      },
    );
  }

  private async executeInternal(
    dto: CreatePaymentDto,
    idempotencyKey?: string,
  ): Promise<CreatePaymentOutput> {
    if (typeof dto.amount !== "number" || dto.amount < 0.01) {
      throw new BadRequestException(
        "Amount deve ser um número positivo maior que 0.01",
      );
    }

    if (!["PIX", "CREDIT_CARD"].includes(dto.paymentMethod)) {
      throw new BadRequestException(
        "PaymentMethod deve ser PIX ou CREDIT_CARD",
      );
    }

    if (!dto.description || dto.description.length > 255) {
      throw new BadRequestException(
        "Description deve ter entre 1 e 255 caracteres",
      );
    }

    if (dto.paymentMethod === PaymentMethod.CREDIT_CARD && !idempotencyKey) {
      throw new BadRequestException(
        "Idempotency-Key é obrigatório para CREDIT_CARD",
      );
    }

    try {
      new Cpf(dto.cpf);
    } catch {
      throw new BadRequestException("CPF inválido");
    }

    const bodyHash = this.idempotencyService.generateBodyHash(
      JSON.stringify(dto),
    );

    if (idempotencyKey) {
      try {
        const idempotencyResult = this.idempotencyService.checkKey(
          idempotencyKey,
          bodyHash,
        );

        if (!idempotencyResult.isNew) {
          const existingPayment = await this.paymentRepository.findById(
            idempotencyResult.paymentId!,
          );
          return { payment: existingPayment!, isNew: false };
        }
      } catch (error) {
        if (
          error instanceof Error &&
          error.message === "IDEMPOTENCY_KEY_CONFLICT"
        ) {
          throw new ConflictException("IDEMPOTENCY_KEY_CONFLICT");
        }
        throw error;
      }
    }

    const payment = Payment.create({
      cpf: dto.cpf,
      description: dto.description,
      amount: dto.amount,
      paymentMethod: dto.paymentMethod,
    });

    if (payment.isCreditCard()) {
      try {
        this.logger.log(
          `Starting Temporal workflow for credit card payment ${payment.id}`,
        );

        const workflowResult =
          await this.temporalClient.startCreditCardPaymentWorkflow({
            paymentId: payment.id,
            cpf: payment.cpf,
            description: payment.description,
            amount: payment.amount,
            idempotencyKey: idempotencyKey || payment.id,
          });

        this.logger.log(
          `Temporal workflow started for payment ${payment.id}: ${workflowResult.workflowId}`,
        );
      } catch (error) {
        this.logger.error(
          `Error starting Temporal workflow for payment ${payment.id}:`,
          error,
        );

        this.logger.log(
          `Falling back to direct provider call for payment ${payment.id}`,
        );

        try {
          const providerResult = await this.tracingService.traceProvider(
            "MercadoPagoProvider",
            "createCreditCardCharge",
            async () =>
              this.paymentProvider.createCreditCardCharge({
                amount: payment.amount,
                description: payment.description,
                idempotencyKey: idempotencyKey || payment.id,
                cpf: payment.cpf,
              }),
            {
              "payment.amount": payment.amount,
              "payment.id": payment.id,
            },
          );

          payment.setProviderRef(providerResult.providerRef);
          this.logger.log(
            `Credit card payment processed successfully with providerRef: ${providerResult.providerRef}`,
          );
        } catch (fallbackError) {
          this.logger.error(
            `Error processing credit card payment ${payment.id} (fallback):`,
            fallbackError,
          );
          throw new ServiceUnavailableException(
            "Payment processing service unavailable",
          );
        }
      }
    }

    const savedPayment = await this.tracingService.traceDatabase(
      "save",
      "payments",
      async () => this.paymentRepository.save(payment),
      {
        "payment.id": payment.id,
        "payment.method": payment.paymentMethod,
      },
    );

    if (idempotencyKey) {
      this.idempotencyService.storeKey(
        idempotencyKey,
        bodyHash,
        savedPayment.id,
      );
    }

    await this.domainEventService.publishPaymentCreated({
      paymentId: savedPayment.id,
      customerId: savedPayment.cpf,
      amount: savedPayment.amount,
      paymentMethod: savedPayment.paymentMethod as any,
      status: savedPayment.status as any,
      timestamp: new Date(),
    });

    return { payment: savedPayment, isNew: true };
  }
}
