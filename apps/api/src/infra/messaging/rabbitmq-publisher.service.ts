import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import * as amqp from "amqplib";

export interface PaymentEvent {
  paymentId: string;
  status: "PENDING" | "PAID" | "FAIL" | "CANCELLED";
  previousStatus?: string;
  amount: number;
  customerId: string;
  paymentMethod: "CREDIT_CARD" | "PIX";
  timestamp: Date;
  metadata?: Record<string, any>;
}

@Injectable()
export class RabbitMQPublisherService implements OnModuleDestroy {
  private readonly logger = new Logger(RabbitMQPublisherService.name);
  private connection: amqp.Connection | null = null;
  private channel: amqp.Channel | null = null;
  private readonly exchangeName = "payment.events";

  async onModuleInit() {
    await this.connect();
  }

  async onModuleDestroy() {
    await this.disconnect();
  }

  private async connect(): Promise<void> {
    try {
      const rabbitmqUrl =
        process.env.RABBITMQ_URL || "amqp://app:app@localhost:5674";

      this.logger.log("Connecting to RabbitMQ...");
      this.connection = await amqp.connect(rabbitmqUrl);

      this.channel = await this.connection.createChannel();

      await this.channel.assertExchange(this.exchangeName, "topic", {
        durable: true,
      });

      this.logger.log("✅ Connected to RabbitMQ successfully");
    } catch (error) {
      this.logger.error("❌ Failed to connect to RabbitMQ:", error);
      throw error;
    }
  }

  private async disconnect(): Promise<void> {
    try {
      if (this.channel) {
        await this.channel.close();
        this.channel = null;
      }
      if (this.connection) {
        await this.connection.close();
        this.connection = null;
      }
      this.logger.log("🔌 Disconnected from RabbitMQ");
    } catch (error) {
      this.logger.error("Error disconnecting from RabbitMQ:", error);
    }
  }

  async publishPaymentCreated(event: PaymentEvent): Promise<void> {
    await this.publishEvent("payment.created", event);
  }

  async publishPaymentStatusChanged(event: PaymentEvent): Promise<void> {
    await this.publishEvent("payment.status.changed", event);
  }

  async publishPaymentApproved(event: PaymentEvent): Promise<void> {
    await this.publishEvent("payment.approved", event);
  }

  async publishPaymentRejected(event: PaymentEvent): Promise<void> {
    await this.publishEvent("payment.rejected", event);
  }

  async publishPaymentCompleted(event: PaymentEvent): Promise<void> {
    await this.publishEvent("payment.completed", event);
  }

  private async publishEvent(
    routingKey: string,
    event: PaymentEvent,
  ): Promise<void> {
    if (!this.channel) {
      this.logger.warn("Channel not available, attempting to reconnect...");
      await this.connect();
    }

    try {
      const message = JSON.stringify({
        ...event,
        timestamp: event.timestamp.toISOString(),
      });

      const published = this.channel!.publish(
        this.exchangeName,
        routingKey,
        Buffer.from(message),
        {
          persistent: true,
          messageId: `${event.paymentId}-${Date.now()}`,
          timestamp: Date.now(),
        },
      );

      if (published) {
        this.logger.log(
          `📤 Published ${routingKey} for payment ${event.paymentId}`,
        );
      } else {
        this.logger.warn(
          `⚠️ Failed to publish ${routingKey} for payment ${event.paymentId}`,
        );
      }
    } catch (error) {
      this.logger.error(`❌ Error publishing ${routingKey}:`, error);
      throw error;
    }
  }

  async isConnected(): Promise<boolean> {
    return this.connection !== null && this.channel !== null;
  }
}
