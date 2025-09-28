import { Injectable, Inject, Logger } from "@nestjs/common";
import {
  RabbitMQPublisherService,
  PaymentEvent,
} from "../../infra/messaging/rabbitmq-publisher.service";

export interface DomainEvent {
  occurredAt: Date;
}

@Injectable()
export class DomainEventService {
  private readonly logger = new Logger(DomainEventService.name);
  private events: DomainEvent[] = [];

  constructor(
    @Inject(RabbitMQPublisherService)
    private readonly rabbitMQPublisher: RabbitMQPublisherService,
  ) {}

  addEvent(event: DomainEvent): void {
    this.events.push(event);
  }

  getEvents(): DomainEvent[] {
    return [...this.events];
  }

  clearEvents(): void {
    this.events = [];
  }

  hasEvents(): boolean {
    return this.events.length > 0;
  }

  async publishPaymentStatusChanged(event: {
    paymentId: string;
    oldStatus: string;
    newStatus: string;
    occurredAt: Date;
    payment?: {
      cpf: string;
      amount: number;
      paymentMethod: string;
    };
  }): Promise<void> {
    this.logger.log(
      `Publishing payment status changed event: ${event.paymentId} ${event.oldStatus} -> ${event.newStatus}`,
    );

    try {
      const paymentEvent: PaymentEvent = {
        paymentId: event.paymentId,
        status: event.newStatus as any,
        previousStatus: event.oldStatus,
        amount: event.payment?.amount || 0,
        customerId: event.payment?.cpf || "",
        paymentMethod: (event.payment?.paymentMethod as any) || "PIX",
        timestamp: event.occurredAt,
        metadata: {
          oldStatus: event.oldStatus,
          newStatus: event.newStatus,
        },
      };

      await this.rabbitMQPublisher.publishPaymentStatusChanged(paymentEvent);
      this.logger.log(
        `✅ Payment status changed event published for ${event.paymentId}`,
      );
    } catch (error) {
      this.logger.error(
        `❌ Failed to publish payment status changed event:`,
        error,
      );
      throw error;
    }
  }

  async publishPaymentCreated(event: PaymentEvent): Promise<void> {
    this.logger.log(`Publishing payment created event: ${event.paymentId}`);

    try {
      await this.rabbitMQPublisher.publishPaymentCreated(event);
      this.logger.log(
        `✅ Payment created event published for ${event.paymentId}`,
      );
    } catch (error) {
      this.logger.error(`❌ Failed to publish payment created event:`, error);
      throw error;
    }
  }

  async publishPaymentApproved(event: PaymentEvent): Promise<void> {
    this.logger.log(`Publishing payment approved event: ${event.paymentId}`);

    try {
      await this.rabbitMQPublisher.publishPaymentApproved(event);
      this.logger.log(
        `✅ Payment approved event published for ${event.paymentId}`,
      );
    } catch (error) {
      this.logger.error(`❌ Failed to publish payment approved event:`, error);
      throw error;
    }
  }

  async publishPaymentRejected(event: PaymentEvent): Promise<void> {
    this.logger.log(`Publishing payment rejected event: ${event.paymentId}`);

    try {
      await this.rabbitMQPublisher.publishPaymentRejected(event);
      this.logger.log(
        `✅ Payment rejected event published for ${event.paymentId}`,
      );
    } catch (error) {
      this.logger.error(`❌ Failed to publish payment rejected event:`, error);
      throw error;
    }
  }

  async publishPaymentCompleted(event: PaymentEvent): Promise<void> {
    this.logger.log(`Publishing payment completed event: ${event.paymentId}`);

    try {
      await this.rabbitMQPublisher.publishPaymentCompleted(event);
      this.logger.log(
        `✅ Payment completed event published for ${event.paymentId}`,
      );
    } catch (error) {
      this.logger.error(`❌ Failed to publish payment completed event:`, error);
      throw error;
    }
  }
}
