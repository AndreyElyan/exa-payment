import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from "@nestjs/common";
import * as amqp from "amqplib";

export interface PaymentEvent {
  paymentId: string;
  status: "PENDING" | "PAID" | "FAIL" | "CANCELLED";
  previousStatus?: string;
  amount: number;
  customerId: string;
  paymentMethod: "CREDIT_CARD" | "PIX";
  timestamp: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class RabbitMQConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RabbitMQConsumerService.name);
  private connection: amqp.Connection | null = null;
  private channel: amqp.Channel | null = null;
  private readonly exchangeName = "payment.events";
  private readonly queues = [
    "payment.created",
    "payment.status.changed",
    "payment.approved",
    "payment.rejected",
    "payment.completed",
  ];

  constructor(
    private readonly onPaymentCreated: (event: PaymentEvent) => Promise<void>,
    private readonly onPaymentStatusChanged: (
      event: PaymentEvent,
    ) => Promise<void>,
    private readonly onPaymentApproved: (event: PaymentEvent) => Promise<void>,
    private readonly onPaymentRejected: (event: PaymentEvent) => Promise<void>,
    private readonly onPaymentCompleted: (event: PaymentEvent) => Promise<void>,
  ) {}

  async onModuleInit() {
    await this.connect();
    await this.setupQueues();
    await this.startConsuming();
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
      if (this.channel && !this.channel.connection.destroyed) {
        await this.channel.close();
        this.channel = null;
      }
      if (this.connection && !this.connection.destroyed) {
        await this.connection.close();
        this.connection = null;
      }
      this.logger.log("🔌 Disconnected from RabbitMQ");
    } catch (error) {
      this.logger.error("Error disconnecting from RabbitMQ:", error);
    }
  }

  private async setupQueues(): Promise<void> {
    if (!this.channel) {
      throw new Error("Channel not available");
    }

    try {
      for (const queueName of this.queues) {
        await this.channel.assertQueue(queueName, {
          durable: true,
        });

        const routingKey = queueName.replace("payment.", "payment.");
        await this.channel.bindQueue(queueName, this.exchangeName, routingKey);

        this.logger.log(
          `📋 Queue ${queueName} configured with routing key ${routingKey}`,
        );
      }

      this.logger.log("✅ All queues configured successfully");
    } catch (error) {
      this.logger.error("❌ Failed to setup queues:", error);
      throw error;
    }
  }

  private async startConsuming(): Promise<void> {
    if (!this.channel) {
      throw new Error("Channel not available");
    }

    try {
      await this.channel.consume("payment.created", async (msg) => {
        if (msg) {
          await this.handleMessage(
            "payment.created",
            msg,
            this.onPaymentCreated,
          );
        }
      });

      await this.channel.consume("payment.status.changed", async (msg) => {
        if (msg) {
          await this.handleMessage(
            "payment.status.changed",
            msg,
            this.onPaymentStatusChanged,
          );
        }
      });

      await this.channel.consume("payment.approved", async (msg) => {
        if (msg) {
          await this.handleMessage(
            "payment.approved",
            msg,
            this.onPaymentApproved,
          );
        }
      });

      await this.channel.consume("payment.rejected", async (msg) => {
        if (msg) {
          await this.handleMessage(
            "payment.rejected",
            msg,
            this.onPaymentRejected,
          );
        }
      });

      await this.channel.consume("payment.completed", async (msg) => {
        if (msg) {
          await this.handleMessage(
            "payment.completed",
            msg,
            this.onPaymentCompleted,
          );
        }
      });

      this.logger.log("✅ Started consuming messages from all queues");
    } catch (error) {
      this.logger.error("❌ Failed to start consuming:", error);
      throw error;
    }
  }

  private async handleMessage(
    queueName: string,
    msg: amqp.ConsumeMessage,
    handler: (event: PaymentEvent) => Promise<void>,
  ): Promise<void> {
    try {
      const content = msg.content.toString();
      const event: PaymentEvent = JSON.parse(content);

      this.logger.log(
        `📨 Received ${queueName} for payment ${event.paymentId}`,
      );

      await handler(event);

      this.channel!.ack(msg);
      this.logger.log(
        `✅ Processed ${queueName} for payment ${event.paymentId}`,
      );
    } catch (error) {
      this.logger.error(`❌ Error processing ${queueName}:`, error);

      if (this.channel && !this.channel.connection.destroyed) {
        try {
          this.channel.nack(msg, false, true);
        } catch (nackError) {
          this.logger.warn(`⚠️ Failed to nack message: ${nackError.message}`);
        }
      }
    }
  }

  async isConnected(): Promise<boolean> {
    return this.connection !== null && this.channel !== null;
  }
}
