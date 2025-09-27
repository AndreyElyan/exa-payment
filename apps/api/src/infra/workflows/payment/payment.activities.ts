import { Injectable, Logger } from "@nestjs/common";
import { PaymentRepository } from "../../../application/ports/payment.repository.port";
import { PaymentProvider } from "../../../application/ports/payment-provider.port";
import { DomainEventService } from "../../../domain/services/domain-event.service";
import { Payment } from "../../../domain/entities/payment.entity";

export interface CreatePaymentRecordInput {
  paymentId: string;
  cpf: string;
  description: string;
  amount: number;
  status: "PENDING" | "PAID" | "FAIL";
}

export interface CreateMercadoPagoPreferenceInput {
  cpf: string;
  description: string;
  amount: number;
  idempotencyKey: string;
}

export interface CreateMercadoPagoPreferenceOutput {
  providerRef: string;
  initPoint: string;
}

export interface UpdatePaymentStatusInput {
  paymentId: string;
  status: "PENDING" | "PAID" | "FAIL";
  providerRef?: string;
}

export interface CheckPaymentStatusInput {
  providerRef: string;
}

export interface PublishStatusChangeEventInput {
  paymentId: string;
  oldStatus: "PENDING" | "PAID" | "FAIL";
  newStatus: "PENDING" | "PAID" | "FAIL";
}

export interface PaymentActivities {
  createPaymentRecord(input: CreatePaymentRecordInput): Promise<void>;
  createMercadoPagoPreference(
    input: CreateMercadoPagoPreferenceInput,
  ): Promise<CreateMercadoPagoPreferenceOutput>;
  updatePaymentStatus(input: UpdatePaymentStatusInput): Promise<void>;
  checkPaymentStatus(input: CheckPaymentStatusInput): Promise<string | null>;
  publishStatusChangeEvent(input: PublishStatusChangeEventInput): Promise<void>;
}

@Injectable()
export class PaymentActivitiesImpl implements PaymentActivities {
  private readonly logger = new Logger(PaymentActivitiesImpl.name);

  constructor(
    private readonly paymentRepository: PaymentRepository,
    private readonly paymentProvider: PaymentProvider,
    private readonly domainEventService: DomainEventService,
  ) {}

  async createPaymentRecord(input: CreatePaymentRecordInput): Promise<void> {
    this.logger.log(`Creating payment record: ${input.paymentId}`);

    const payment = Payment.create({
      id: input.paymentId,
      cpf: input.cpf,
      description: input.description,
      amount: input.amount,
      paymentMethod: "CREDIT_CARD",
      status: input.status,
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

    payment.transitionTo(input.status);
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
      await this.domainEventService.publishPaymentStatusChanged({
        paymentId: input.paymentId,
        oldStatus: input.oldStatus,
        newStatus: input.newStatus,
        occurredAt: new Date(),
      });
    }

    this.logger.log(`Status change event published: ${input.paymentId}`);
  }
}
