import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import { AuditLog, AuditLogDocument } from "../schemas/audit-log.schema";
import {
  PaymentStatusChangedEvent,
  PaymentCreatedEvent,
  PaymentApprovedEvent,
  PaymentRejectedEvent,
  PaymentCompletedEvent,
} from "../consumers/payment-event.consumer";

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    @InjectModel(AuditLog.name) private auditLogModel: Model<AuditLogDocument>,
  ) {}

  async logPaymentStatusChange(
    event: PaymentStatusChangedEvent,
  ): Promise<void> {
    this.logger.log(
      `📝 Logging PaymentStatusChange to audit for payment ${event.paymentId}`,
    );

    const auditLog = new this.auditLogModel({
      eventType: "PAYMENT_STATUS_CHANGED",
      paymentId: event.paymentId,
      status: event.status,
      previousStatus: event.previousStatus,
      amount: event.amount,
      customerId: event.customerId,
      paymentMethod: event.paymentMethod,
      timestamp: event.timestamp,
      metadata: {
        ...event.metadata,
        source: "payment-api",
        processedAt: new Date(),
      },
    });

    await auditLog.save();

    this.logger.log(
      `✅ PaymentStatusChange audit logged for payment ${event.paymentId}`,
    );
  }

  async logPaymentCreated(event: PaymentCreatedEvent): Promise<void> {
    this.logger.log(
      `📝 Logging PaymentCreated to audit for payment ${event.paymentId}`,
    );

    const auditLog = new this.auditLogModel({
      eventType: "PAYMENT_CREATED",
      paymentId: event.paymentId,
      status: event.status,
      amount: event.amount,
      customerId: event.customerId,
      paymentMethod: event.paymentMethod,
      timestamp: event.timestamp,
      metadata: {
        ...event.metadata,
        description: event.description,
        source: "payment-api",
        processedAt: new Date(),
      },
    });

    await auditLog.save();

    this.logger.log(
      `✅ PaymentCreated audit logged for payment ${event.paymentId}`,
    );
  }

  async logPaymentApproved(event: PaymentApprovedEvent): Promise<void> {
    this.logger.log(
      `📝 Logging PaymentApproved to audit for payment ${event.paymentId}`,
    );

    const auditLog = new this.auditLogModel({
      eventType: "PAYMENT_APPROVED",
      paymentId: event.paymentId,
      status: event.status,
      amount: event.amount,
      customerId: event.customerId,
      paymentMethod: event.paymentMethod,
      timestamp: event.timestamp,
      metadata: {
        ...event.metadata,
        providerRef: event.providerRef,
        source: "payment-api",
        processedAt: new Date(),
      },
    });

    await auditLog.save();

    this.logger.log(
      `✅ PaymentApproved audit logged for payment ${event.paymentId}`,
    );
  }

  async logPaymentRejected(event: PaymentRejectedEvent): Promise<void> {
    this.logger.log(
      `📝 Logging PaymentRejected to audit for payment ${event.paymentId}`,
    );

    const auditLog = new this.auditLogModel({
      eventType: "PAYMENT_REJECTED",
      paymentId: event.paymentId,
      status: event.status,
      amount: event.amount,
      customerId: event.customerId,
      paymentMethod: event.paymentMethod,
      timestamp: event.timestamp,
      metadata: {
        ...event.metadata,
        reason: event.reason,
        source: "payment-api",
        processedAt: new Date(),
      },
    });

    await auditLog.save();

    this.logger.log(
      `✅ PaymentRejected audit logged for payment ${event.paymentId}`,
    );
  }

  async logPaymentCompleted(event: PaymentCompletedEvent): Promise<void> {
    this.logger.log(
      `📝 Logging PaymentCompleted to audit for payment ${event.paymentId}`,
    );

    const auditLog = new this.auditLogModel({
      eventType: "PAYMENT_COMPLETED",
      paymentId: event.paymentId,
      status: event.status,
      amount: event.amount,
      customerId: event.customerId,
      paymentMethod: event.paymentMethod,
      timestamp: event.timestamp,
      metadata: {
        ...event.metadata,
        duration: event.duration,
        source: "payment-api",
        processedAt: new Date(),
      },
    });

    await auditLog.save();

    this.logger.log(
      `✅ PaymentCompleted audit logged for payment ${event.paymentId}`,
    );
  }

  async getAuditLogs(
    paymentId?: string,
    eventType?: string,
    limit = 100,
  ): Promise<AuditLogDocument[]> {
    const filter: any = {};

    if (paymentId) filter.paymentId = paymentId;
    if (eventType) filter.eventType = eventType;

    return this.auditLogModel
      .find(filter)
      .sort({ timestamp: -1 })
      .limit(limit)
      .exec();
  }

  async getAuditStats(): Promise<any> {
    const stats = await this.auditLogModel.aggregate([
      {
        $group: {
          _id: "$eventType",
          count: { $sum: 1 },
          totalAmount: { $sum: "$amount" },
          avgAmount: { $avg: "$amount" },
        },
      },
      {
        $sort: { count: -1 },
      },
    ]);

    return stats;
  }
}
