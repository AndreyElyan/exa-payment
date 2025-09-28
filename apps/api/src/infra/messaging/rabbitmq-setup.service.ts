import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import * as amqp from "amqplib";

@Injectable()
export class RabbitMQSetupService implements OnModuleInit {
  private readonly logger = new Logger(RabbitMQSetupService.name);
  private connection: amqp.Connection | null = null;
  private channel: amqp.Channel | null = null;

  async onModuleInit() {
    await this.setupRabbitMQ();
  }

  private async setupRabbitMQ(): Promise<void> {
    try {
      const rabbitmqUrl =
        process.env.RABBITMQ_URL || "amqp://app:app@localhost:5674";

      this.logger.log("🔧 Configurando RabbitMQ automaticamente...");

      this.connection = await amqp.connect(rabbitmqUrl);
      this.channel = await this.connection.createChannel();

      await this.channel.assertExchange("payment.events", "topic", {
        durable: true,
      });

      this.logger.log("✅ Exchange payment.events configurada");

      const queues = [
        "payment.created",
        "payment.status.changed",
        "payment.approved",
        "payment.rejected",
        "payment.completed",
      ];

      for (const queueName of queues) {
        await this.channel.assertQueue(queueName, {
          durable: true,
        });

        const routingKey = queueName;
        await this.channel.bindQueue(queueName, "payment.events", routingKey);

        this.logger.log(
          `✅ Queue ${queueName} configurada com routing key ${routingKey}`,
        );
      }

      this.logger.log("🎉 RabbitMQ configurado automaticamente com sucesso!");
    } catch (error) {
      this.logger.warn(
        "⚠️ Falha ao configurar RabbitMQ automaticamente:",
        error.message,
      );
      this.logger.warn(
        "⚠️ As aplicações continuarão funcionando, mas eventos podem não ser publicados",
      );
    }
  }

  async onModuleDestroy() {
    try {
      if (this.channel) {
        await this.channel.close();
      }
      if (this.connection) {
        await this.connection.close();
      }
    } catch (error) {
      this.logger.error("Error closing RabbitMQ connection:", error);
    }
  }
}
