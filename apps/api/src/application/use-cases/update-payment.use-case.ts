import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PaymentRepository } from "../ports/payment.repository.port";
import { Payment, PaymentStatus } from "../../domain/entities/payment.entity";
import { UpdatePaymentDto } from "../../interfaces/dto/update-payment.dto";
import { DomainEventService } from "../../domain/services/domain-event.service";
import { CustomTracingService } from "../../infra/observability/tracing.service";

export interface UpdatePaymentInput {
  id: string;
  dto: UpdatePaymentDto;
}

export interface UpdatePaymentOutput {
  payment: Payment;
  statusChanged: boolean;
}

@Injectable()
export class UpdatePaymentUseCase {
  constructor(
    @Inject("PaymentRepository")
    private readonly paymentRepository: PaymentRepository,
    private readonly domainEventService: DomainEventService,
    private readonly tracingService: CustomTracingService,
  ) {}

  async execute(input: UpdatePaymentInput): Promise<UpdatePaymentOutput> {
    return this.tracingService.traceUseCase(
      "UpdatePaymentUseCase",
      "execute",
      async () => {
        const { id, dto } = input;
        return this.executeInternal(id, dto);
      },
      {
        "payment.id": input.id,
        "payment.status": input.dto.status,
      },
    );
  }

  private async executeInternal(
    id: string,
    dto: UpdatePaymentDto,
  ): Promise<UpdatePaymentOutput> {
    const existingPayment = await this.tracingService.traceDatabase(
      "findById",
      "payments",
      async () => this.paymentRepository.findById(id),
      { "payment.id": id },
    );

    if (!existingPayment) {
      throw new NotFoundException("Payment not found");
    }

    const oldStatus = existingPayment.status;
    const newStatus = dto.status;

    try {
      existingPayment.transitionTo(newStatus);
    } catch (error) {
      throw new BadRequestException({
        code: "INVALID_STATE_TRANSITION",
        message: error.message,
      });
    }

    const updatedPayment = await this.tracingService.traceDatabase(
      "update",
      "payments",
      async () => this.paymentRepository.update(existingPayment),
      {
        "payment.id": existingPayment.id,
        "payment.status": dto.status,
      },
    );

    const statusChanged = oldStatus !== newStatus;

    if (statusChanged) {
      await this.domainEventService.publishPaymentStatusChanged({
        paymentId: updatedPayment.id,
        oldStatus,
        newStatus,
        occurredAt: new Date(),
        payment: {
          cpf: updatedPayment.cpf,
          amount: updatedPayment.amount,
          paymentMethod: updatedPayment.paymentMethod,
        },
      });

      const domainEvents = updatedPayment.getDomainEvents();
      domainEvents.forEach((event) => {
        this.domainEventService.addEvent(event);
      });
      updatedPayment.clearDomainEvents();
    }

    return {
      payment: updatedPayment,
      statusChanged,
    };
  }
}
