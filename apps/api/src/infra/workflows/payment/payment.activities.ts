import { Injectable, Logger, Inject } from "@nestjs/common";
import { PaymentRepository } from "../../../application/ports/payment.repository.port";
import { PaymentProvider } from "../../../application/ports/payment-provider.port";
import { DomainEventService } from "../../../domain/services/domain-event.service";
import {
  Payment,
  PaymentMethod,
  PaymentStatus,
} from "../../../domain/entities/payment.entity";
import {
  CreatePaymentRecordInput,
  CreateMercadoPagoPreferenceInput,
  CreateMercadoPagoPreferenceOutput,
  UpdatePaymentStatusInput,
  CheckPaymentStatusInput,
  PublishStatusChangeEventInput,
  PaymentActivities,
} from "./payment.activities.interfaces";

@Injectable()
export class PaymentActivitiesImpl implements PaymentActivities {
  private readonly logger = new Logger(PaymentActivitiesImpl.name);

  constructor(
    @Inject("PaymentRepository")
    private readonly paymentRepository: PaymentRepository,
    @Inject("PaymentProvider")
    private readonly paymentProvider: PaymentProvider,
    private readonly domainEventService: DomainEventService,
  ) {}

  async createPaymentRecord(input: CreatePaymentRecordInput): Promise<void> {
    this.logger.log(`Creating payment record: ${input.paymentId}`);

    const payment = Payment.create({
      cpf: input.cpf,
      description: input.description,
      amount: input.amount,
      paymentMethod: PaymentMethod.CREDIT_CARD,
    });

    await this.paymentRepository.save(payment);
    this.logger.log(`Payment record created: ${input.paymentId}`);
  }

  async createMercadoPagoPreference(
    input: CreateMercadoPagoPreferenceInput,
  ): Promise<CreateMercadoPagoPreferenceOutput> {
    this.logger.log(`Creating Mercado Pago preference for payment`);

    const result = await this.paymentProvider.createCreditCardCharge({
      cpf: input.cpf,
      description: input.description,
      amount: input.amount,
      idempotencyKey: input.idempotencyKey,
    });

    this.logger.log(`Mercado Pago preference created: ${result.providerRef}`);

    return {
      providerRef: result.providerRef,
      initPoint: result.initPoint || "",
    };
  }

  async updatePaymentStatus(input: UpdatePaymentStatusInput): Promise<void> {
    this.logger.log(
      `Updating payment status: ${input.paymentId} -> ${input.status}`,
    );

    const payment = await this.paymentRepository.findById(input.paymentId);
    if (!payment) {
      throw new Error(`Payment not found: ${input.paymentId}`);
    }

    if (input.providerRef) {
      payment.setProviderRef(input.providerRef);
    }

    payment.transitionTo(input.status as PaymentStatus);
    await this.paymentRepository.update(payment);

    this.logger.log(
      `Payment status updated: ${input.paymentId} -> ${input.status}`,
    );
  }

  async checkPaymentStatus(
    input: CheckPaymentStatusInput,
  ): Promise<string | null> {
    this.logger.log(
      `Checking payment status for provider ref: ${input.providerRef}`,
    );

    try {
      if ("getPaymentStatus" in this.paymentProvider) {
        const status = await (this.paymentProvider as any).getPaymentStatus(
          input.providerRef,
        );
        this.logger.log(`Payment status from provider: ${status}`);
        return status;
      }

      return null;
    } catch (error) {
      this.logger.warn(`Failed to check payment status: ${error.message}`);
      return null;
    }
  }

  async publishStatusChangeEvent(
    input: PublishStatusChangeEventInput,
  ): Promise<void> {
    this.logger.log(
      `Publishing status change event: ${input.paymentId} ${input.oldStatus} -> ${input.newStatus}`,
    );

    if (input.oldStatus !== input.newStatus) {
      const payment = await this.paymentRepository.findById(input.paymentId);

      if (payment) {
        await this.domainEventService.publishPaymentStatusChanged({
          paymentId: input.paymentId,
          oldStatus: input.oldStatus,
          newStatus: input.newStatus,
          occurredAt: new Date(),
          payment: {
            cpf: payment.cpf,
            amount: payment.amount,
            paymentMethod: payment.paymentMethod,
          },
        });
      } else {
        this.logger.warn(
          `Payment ${input.paymentId} not found, publishing event without payment data`,
        );
        await this.domainEventService.publishPaymentStatusChanged({
          paymentId: input.paymentId,
          oldStatus: input.oldStatus,
          newStatus: input.newStatus,
          occurredAt: new Date(),
        });
      }
    }

    this.logger.log(`Status change event published: ${input.paymentId}`);
  }
}
