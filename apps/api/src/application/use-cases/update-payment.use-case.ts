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
  ) {}

  async execute(input: UpdatePaymentInput): Promise<UpdatePaymentOutput> {
    const { id, dto } = input;

    const existingPayment = await this.paymentRepository.findById(id);

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

    const updatedPayment = await this.paymentRepository.update(existingPayment);

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
