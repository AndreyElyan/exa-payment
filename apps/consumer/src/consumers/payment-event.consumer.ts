import { Injectable, Logger } from "@nestjs/common";
import { AuditService } from "../services/audit.service";
import { NotificationService } from "../services/notification.service";
import { AnalyticsService } from "../services/analytics.service";
import {
  RabbitMQConsumerService,
  PaymentEvent,
} from "../infra/messaging/rabbitmq-consumer.service";

export interface PaymentStatusChangedEvent {
  paymentId: string;
  status: "PENDING" | "PAID" | "FAIL" | "CANCELLED";
  previousStatus?: string;
  amount: number;
  customerId: string;
  paymentMethod: "CREDIT_CARD" | "PIX";
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface PaymentCreatedEvent {
  paymentId: string;
  status: "PENDING";
  amount: number;
  customerId: string;
  paymentMethod: "CREDIT_CARD" | "PIX";
  description: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface PaymentApprovedEvent {
  paymentId: string;
  status: "PAID";
  amount: number;
  customerId: string;
  paymentMethod: "CREDIT_CARD" | "PIX";
  providerRef: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface PaymentRejectedEvent {
  paymentId: string;
  status: "FAIL";
  amount: number;
  customerId: string;
  paymentMethod: "CREDIT_CARD" | "PIX";
  reason?: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface PaymentCompletedEvent {
  paymentId: string;
  status: "PAID" | "FAIL";
  amount: number;
  customerId: string;
  paymentMethod: "CREDIT_CARD" | "PIX";
  duration: number; // em segundos
  timestamp: Date;
  metadata?: Record<string, any>;
}

@Injectable()
export class PaymentEventConsumer {
  private readonly logger = new Logger(PaymentEventConsumer.name);
  private rabbitMQConsumer: RabbitMQConsumerService | null = null;

  constructor(
    private readonly auditService: AuditService,
    private readonly notificationService: NotificationService,
    private readonly analyticsService: AnalyticsService,
  ) {}

  async onModuleInit() {
    this.logger.log("🚀 Initializing RabbitMQ Consumer...");

    this.rabbitMQConsumer = new RabbitMQConsumerService(
      this.handlePaymentCreated.bind(this),
      this.handlePaymentStatusChanged.bind(this),
      this.handlePaymentApproved.bind(this),
      this.handlePaymentRejected.bind(this),
      this.handlePaymentCompleted.bind(this),
    );

    await this.rabbitMQConsumer.onModuleInit();
    this.logger.log("✅ RabbitMQ Consumer initialized successfully");
  }

  async onModuleDestroy() {
    if (this.rabbitMQConsumer) {
      await this.rabbitMQConsumer.onModuleDestroy();
    }
  }

  async handlePaymentStatusChanged(event: PaymentEvent) {
    this.logger.log(
      `📊 Processing PaymentStatusChanged event for payment ${event.paymentId}`,
    );

    try {
      const statusChangedEvent: PaymentStatusChangedEvent = {
        paymentId: event.paymentId,
        status: event.status,
        previousStatus: event.previousStatus,
        amount: event.amount,
        customerId: event.customerId,
        paymentMethod: event.paymentMethod,
        timestamp: new Date(event.timestamp),
        metadata: event.metadata,
      };

      // 1. Auditoria - Registrar evento
      await this.auditService.logPaymentStatusChange(statusChangedEvent);

      // 2. Notificação - Enviar confirmação
      await this.notificationService.sendPaymentStatusNotification(
        statusChangedEvent,
      );

      // 3. Analytics - Atualizar projeções
      await this.analyticsService.updatePaymentProjections(statusChangedEvent);

      this.logger.log(
        `✅ Successfully processed PaymentStatusChanged for payment ${event.paymentId}`,
      );
    } catch (error) {
      this.logger.error(
        `❌ Error processing PaymentStatusChanged for payment ${event.paymentId}:`,
        error,
      );
      throw error;
    }
  }

  async handlePaymentCreated(event: PaymentEvent) {
    this.logger.log(
      `🆕 Processing PaymentCreated event for payment ${event.paymentId}`,
    );

    try {
      const paymentCreatedEvent: PaymentCreatedEvent = {
        paymentId: event.paymentId,
        status: "PENDING",
        amount: event.amount,
        customerId: event.customerId,
        paymentMethod: event.paymentMethod,
        description: event.metadata?.description || "",
        timestamp: new Date(event.timestamp),
        metadata: event.metadata,
      };

      // 1. Auditoria
      await this.auditService.logPaymentCreated(paymentCreatedEvent);

      // 2. Notificação
      await this.notificationService.sendPaymentCreatedNotification(
        paymentCreatedEvent,
      );

      // 3. Analytics
      await this.analyticsService.updatePaymentProjections(paymentCreatedEvent);

      this.logger.log(
        `✅ Successfully processed PaymentCreated for payment ${event.paymentId}`,
      );
    } catch (error) {
      this.logger.error(
        `❌ Error processing PaymentCreated for payment ${event.paymentId}:`,
        error,
      );
      throw error;
    }
  }

  async handlePaymentApproved(event: PaymentEvent) {
    this.logger.log(
      `✅ Processing PaymentApproved event for payment ${event.paymentId}`,
    );

    try {
      const paymentApprovedEvent: PaymentApprovedEvent = {
        paymentId: event.paymentId,
        status: "PAID",
        amount: event.amount,
        customerId: event.customerId,
        paymentMethod: event.paymentMethod,
        providerRef: event.metadata?.providerRef || "",
        timestamp: new Date(event.timestamp),
        metadata: event.metadata,
      };

      // 1. Auditoria
      await this.auditService.logPaymentApproved(paymentApprovedEvent);

      // 2. Notificação
      await this.notificationService.sendPaymentApprovedNotification(
        paymentApprovedEvent,
      );

      // 3. Analytics
      await this.analyticsService.updatePaymentProjections(
        paymentApprovedEvent,
      );

      this.logger.log(
        `✅ Successfully processed PaymentApproved for payment ${event.paymentId}`,
      );
    } catch (error) {
      this.logger.error(
        `❌ Error processing PaymentApproved for payment ${event.paymentId}:`,
        error,
      );
      throw error;
    }
  }

  async handlePaymentRejected(event: PaymentEvent) {
    this.logger.log(
      `❌ Processing PaymentRejected event for payment ${event.paymentId}`,
    );

    try {
      const paymentRejectedEvent: PaymentRejectedEvent = {
        paymentId: event.paymentId,
        status: "FAIL",
        amount: event.amount,
        customerId: event.customerId,
        paymentMethod: event.paymentMethod,
        reason: event.metadata?.reason,
        timestamp: new Date(event.timestamp),
        metadata: event.metadata,
      };

      // 1. Auditoria
      await this.auditService.logPaymentRejected(paymentRejectedEvent);

      // 2. Notificação
      await this.notificationService.sendPaymentRejectedNotification(
        paymentRejectedEvent,
      );

      // 3. Analytics
      await this.analyticsService.updatePaymentProjections(
        paymentRejectedEvent,
      );

      this.logger.log(
        `✅ Successfully processed PaymentRejected for payment ${event.paymentId}`,
      );
    } catch (error) {
      this.logger.error(
        `❌ Error processing PaymentRejected for payment ${event.paymentId}:`,
        error,
      );
      throw error;
    }
  }

  async handlePaymentCompleted(event: PaymentEvent) {
    this.logger.log(
      `🏁 Processing PaymentCompleted event for payment ${event.paymentId}`,
    );

    try {
      const paymentCompletedEvent: PaymentCompletedEvent = {
        paymentId: event.paymentId,
        status: event.status as "PAID" | "FAIL",
        amount: event.amount,
        customerId: event.customerId,
        paymentMethod: event.paymentMethod,
        duration: event.metadata?.duration || 0,
        timestamp: new Date(event.timestamp),
        metadata: event.metadata,
      };

      // 1. Auditoria
      await this.auditService.logPaymentCompleted(paymentCompletedEvent);

      // 2. Notificação
      await this.notificationService.sendPaymentCompletedNotification(
        paymentCompletedEvent,
      );

      // 3. Analytics
      await this.analyticsService.updatePaymentProjections(
        paymentCompletedEvent,
      );

      this.logger.log(
        `✅ Successfully processed PaymentCompleted for payment ${event.paymentId}`,
      );
    } catch (error) {
      this.logger.error(
        `❌ Error processing PaymentCompleted for payment ${event.paymentId}:`,
        error,
      );
      throw error;
    }
  }
}
