import { Injectable, Logger } from "@nestjs/common";

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  async sendPaymentStatusNotification(event: any): Promise<void> {
    this.logger.log(`📧 Payment Status Notification: ${event.paymentId}`);
    console.log(
      `📧 PAYMENT STATUS NOTIFICATION: ${event.paymentId} - ${event.status}`,
    );
  }

  async sendPaymentCreatedNotification(event: any): Promise<void> {
    this.logger.log(`📧 Payment Created Notification: ${event.paymentId}`);
    console.log(`📧 PAYMENT CREATED NOTIFICATION: ${event.paymentId}`);
  }

  async sendPaymentApprovedNotification(event: any): Promise<void> {
    this.logger.log(`📧 Payment Approved Notification: ${event.paymentId}`);
    console.log(`📧 PAYMENT APPROVED NOTIFICATION: ${event.paymentId}`);
  }

  async sendPaymentRejectedNotification(event: any): Promise<void> {
    this.logger.log(`📧 Payment Rejected Notification: ${event.paymentId}`);
    console.log(`📧 PAYMENT REJECTED NOTIFICATION: ${event.paymentId}`);
  }

  async sendPaymentCompletedNotification(event: any): Promise<void> {
    this.logger.log(`📧 Payment Completed Notification: ${event.paymentId}`);
    console.log(`📧 PAYMENT COMPLETED NOTIFICATION: ${event.paymentId}`);
  }
}
