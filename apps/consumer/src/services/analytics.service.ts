import { Injectable, Logger } from "@nestjs/common";
import { InjectModel } from "@nestjs/mongoose";
import { Model } from "mongoose";
import {
  PaymentSnapshot,
  PaymentSnapshotDocument,
} from "../schemas/payment-snapshot.schema";
import {
  PaymentStatusChangedEvent,
  PaymentCreatedEvent,
  PaymentApprovedEvent,
  PaymentRejectedEvent,
  PaymentCompletedEvent,
} from "../consumers/payment-event.consumer";

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    @InjectModel(PaymentSnapshot.name)
    private paymentSnapshotModel: Model<PaymentSnapshotDocument>,
  ) {}

  async updatePaymentProjections(event: any): Promise<void> {
    this.logger.log(
      `📊 Updating payment projections for payment ${event.paymentId}`,
    );

    try {
      await this.updateStatusProjection(event);

      await this.updatePaymentMethodProjection(event);

      await this.updateDailyProjection(event);

      await this.updateCustomerProjection(event);

      this.logger.log(
        `✅ Payment projections updated for payment ${event.paymentId}`,
      );
    } catch (error) {
      this.logger.error(
        `❌ Error updating payment projections for payment ${event.paymentId}:`,
        error,
      );
      throw error;
    }
  }

  private async updateStatusProjection(event: any): Promise<void> {
    const date = new Date(event.timestamp);
    const dateKey = date.toISOString().split("T")[0]; // YYYY-MM-DD

    this.logger.log(
      `🔍 DEBUG: Saving status projection for ${event.paymentId} - Status: ${event.status}, Method: ${event.paymentMethod}, Date: ${dateKey}`,
    );

    try {
      const result = await this.paymentSnapshotModel.updateOne(
        {
          type: "status",
          date: dateKey,
          status: event.status,
          paymentMethod: event.paymentMethod,
        },
        {
          $inc: {
            count: 1,
            totalAmount: event.amount,
          },
          $set: {
            lastUpdated: new Date(),
          },
        },
        { upsert: true },
      );

      this.logger.log(
        `✅ Status projection saved: Modified: ${result.modifiedCount}, Upserted: ${result.upsertedCount}`,
      );
    } catch (error) {
      this.logger.error(`❌ Error saving status projection:`, error);
      throw error;
    }
  }

  private async updatePaymentMethodProjection(event: any): Promise<void> {
    const date = new Date(event.timestamp);
    const dateKey = date.toISOString().split("T")[0]; // YYYY-MM-DD

    await this.paymentSnapshotModel.updateOne(
      {
        type: "payment_method",
        date: dateKey,
        paymentMethod: event.paymentMethod,
        status: event.status,
      },
      {
        $inc: {
          count: 1,
          totalAmount: event.amount,
        },
        $set: {
          lastUpdated: new Date(),
        },
      },
      { upsert: true },
    );
  }

  private async updateDailyProjection(event: any): Promise<void> {
    const date = new Date(event.timestamp);
    const dateKey = date.toISOString().split("T")[0]; // YYYY-MM-DD

    await this.paymentSnapshotModel.updateOne(
      {
        type: "daily",
        date: dateKey,
      },
      {
        $inc: {
          totalPayments: 1,
          totalAmount: event.amount,
          [`status_${event.status.toLowerCase()}`]: 1,
          [`method_${event.paymentMethod.toLowerCase()}`]: 1,
        },
        $set: {
          lastUpdated: new Date(),
        },
      },
      { upsert: true },
    );
  }

  private async updateCustomerProjection(event: any): Promise<void> {
    const date = new Date(event.timestamp);
    const dateKey = date.toISOString().split("T")[0]; // YYYY-MM-DD

    await this.paymentSnapshotModel.updateOne(
      {
        type: "customer",
        date: dateKey,
        customerId: event.customerId,
      },
      {
        $inc: {
          totalPayments: 1,
          totalAmount: event.amount,
          [`status_${event.status.toLowerCase()}`]: 1,
          [`method_${event.paymentMethod.toLowerCase()}`]: 1,
        },
        $set: {
          lastUpdated: new Date(),
        },
      },
      { upsert: true },
    );
  }

  async generateAnalyticsReport(
    startDate: string,
    endDate: string,
  ): Promise<any> {
    this.logger.log(
      `📊 Generating analytics report from ${startDate} to ${endDate}`,
    );

    const report = await this.paymentSnapshotModel.aggregate([
      {
        $match: {
          date: { $gte: startDate, $lte: endDate },
        },
      },
      {
        $group: {
          _id: {
            type: "$type",
            date: "$date",
            status: "$status",
            paymentMethod: "$paymentMethod",
          },
          totalCount: { $sum: "$count" },
          totalAmount: { $sum: "$totalAmount" },
          avgAmount: { $avg: "$totalAmount" },
        },
      },
      {
        $sort: { "_id.date": 1, "_id.type": 1 },
      },
    ]);

    return report;
  }

  async exportToBigQueryFormat(
    startDate: string,
    endDate: string,
  ): Promise<any[]> {
    this.logger.log(
      `📊 Exporting data to BigQuery format from ${startDate} to ${endDate}`,
    );

    const data = await this.paymentSnapshotModel
      .find({
        date: { $gte: startDate, $lte: endDate },
      })
      .lean();

    const bigQueryData = data.map((snapshot) => ({
      date: snapshot.date,
      type: snapshot.type,
      status: snapshot.status,
      paymentMethod: snapshot.paymentMethod,
      customerId: snapshot.customerId,
      count: snapshot.count,
      totalAmount: snapshot.totalAmount,
      avgAmount: snapshot.totalAmount / snapshot.count,
      lastUpdated: snapshot.lastUpdated,
      amountInReais: snapshot.totalAmount / 100,
      timestamp: snapshot.lastUpdated,
    }));

    return bigQueryData;
  }

  async getRealTimeStats(): Promise<any> {
    const today = new Date().toISOString().split("T")[0];

    const stats = await this.paymentSnapshotModel.aggregate([
      {
        $match: {
          date: today,
          type: "daily",
        },
      },
      {
        $group: {
          _id: null,
          totalPayments: { $sum: "$totalPayments" },
          totalAmount: { $sum: "$totalAmount" },
          paidPayments: { $sum: "$status_paid" },
          failedPayments: { $sum: "$status_fail" },
          pendingPayments: { $sum: "$status_pending" },
          creditCardPayments: { $sum: "$method_credit_card" },
          pixPayments: { $sum: "$method_pix" },
        },
      },
    ]);

    return (
      stats[0] || {
        totalPayments: 0,
        totalAmount: 0,
        paidPayments: 0,
        failedPayments: 0,
        pendingPayments: 0,
        creditCardPayments: 0,
        pixPayments: 0,
      }
    );
  }
}
