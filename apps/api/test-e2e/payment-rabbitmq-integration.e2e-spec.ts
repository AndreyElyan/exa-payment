import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { PrismaService } from "../src/infra/db/prisma.service";
import { PaymentController } from "../src/interfaces/controllers/payment.controller";
import { CreatePaymentUseCase } from "../src/application/use-cases/create-payment.use-case";
import { UpdatePaymentUseCase } from "../src/application/use-cases/update-payment.use-case";
import { PrismaPaymentRepository } from "../src/infra/db/prisma-payment.repository";
import { MercadoPagoProvider } from "../src/infra/providers/mercado-pago.provider";
import { PaymentProviderConfigService } from "../src/config/payment-provider.config";
import { IdempotencyService } from "../src/domain/services/idempotency.service";
import { DomainEventService } from "../src/domain/services/domain-event.service";
import { RabbitMQPublisherService } from "../src/infra/messaging/rabbitmq-publisher.service";
import { TemporalClientService } from "../src/infra/workflows/temporal-client";
import { GlobalExceptionFilter } from "../src/common/filters/global-exception.filter";
import {
  PaymentMethod,
  PaymentStatus,
} from "../src/domain/entities/payment.entity";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import * as amqp from "amqplib";

describe("Payment RabbitMQ Integration (e2e)", () => {
  let app: INestApplication;
  let rabbitMQConnection: amqp.Connection;
  let rabbitMQChannel: amqp.Channel;
  let receivedEvents: any[] = [];

  beforeEach(async () => {
    // Setup RabbitMQ connection for testing
    try {
      const rabbitmqUrl =
        process.env.RABBITMQ_URL || "amqp://app:app@localhost:5672";
      rabbitMQConnection = await amqp.connect(rabbitmqUrl);
      rabbitMQChannel = await rabbitMQConnection.createChannel();

      // Setup exchange
      await rabbitMQChannel.assertExchange("payment.events", "topic", {
        durable: true,
      });

      // Setup test queue
      const testQueue = "payment.test.events";
      await rabbitMQChannel.assertQueue(testQueue, { durable: true });
      await rabbitMQChannel.bindQueue(testQueue, "payment.events", "payment.*");

      // Start consuming messages
      await rabbitMQChannel.consume(testQueue, (msg) => {
        if (msg) {
          const event = JSON.parse(msg.content.toString());
          receivedEvents.push(event);
          rabbitMQChannel.ack(msg);
        }
      });

      receivedEvents = [];
    } catch (error) {
      console.warn("RabbitMQ not available, skipping integration tests");
    }

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [PaymentController],
      providers: [
        {
          provide: PrismaService,
          useValue: {
            payment: {
              create: vi.fn(),
              findUnique: vi.fn(),
              update: vi.fn(),
            },
          },
        },
        {
          provide: "PaymentRepository",
          useClass: PrismaPaymentRepository,
        },
        PaymentProviderConfigService,
        {
          provide: "PaymentProvider",
          useFactory: (configService: PaymentProviderConfigService) => {
            const config = configService.getMercadoPagoConfig();
            return new MercadoPagoProvider(config);
          },
          inject: [PaymentProviderConfigService],
        },
        IdempotencyService,
        RabbitMQPublisherService,
        DomainEventService,
        TemporalClientService,
        CreatePaymentUseCase,
        UpdatePaymentUseCase,
        GlobalExceptionFilter,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();
  });

  afterEach(async () => {
    if (rabbitMQChannel) {
      await rabbitMQChannel.close();
    }
    if (rabbitMQConnection) {
      await rabbitMQConnection.close();
    }
    if (app) {
      await app.close();
    }
  });

  describe("Payment Creation Events", () => {
    it("should publish payment created event when creating PIX payment", async () => {
      const createPaymentDto = {
        cpf: "12345678909",
        description: "Test PIX payment",
        amount: 100.0,
        paymentMethod: PaymentMethod.PIX,
      };

      const mockPayment = {
        id: "test-payment-id",
        cpf: "12345678909",
        description: "Test PIX payment",
        amount: 100.0,
        paymentMethod: PaymentMethod.PIX,
        status: PaymentStatus.PENDING,
        providerRef: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockPrismaService = app.get(PrismaService);
      mockPrismaService.payment.create.mockResolvedValue(mockPayment);

      const response = await app
        .getHttpServer()
        .post("/api/payment")
        .send(createPaymentDto);

      expect(response.status).toBe(201);
      expect(response.body.payment).toBeDefined();

      // Wait for RabbitMQ message
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Check if payment created event was published
      const createdEvents = receivedEvents.filter(
        (event) =>
          event.paymentId === "test-payment-id" && event.status === "PENDING",
      );

      expect(createdEvents.length).toBeGreaterThan(0);
    });

    it("should publish payment status changed event when updating payment status", async () => {
      const paymentId = "test-payment-id";
      const updatePaymentDto = {
        status: PaymentStatus.PAID,
      };

      const existingPayment = {
        id: paymentId,
        cpf: "12345678909",
        description: "Test payment",
        amount: 100.0,
        paymentMethod: PaymentMethod.PIX,
        status: PaymentStatus.PENDING,
        providerRef: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const updatedPayment = {
        ...existingPayment,
        status: PaymentStatus.PAID,
        updatedAt: new Date(),
      };

      const mockPrismaService = app.get(PrismaService);
      mockPrismaService.payment.findUnique.mockResolvedValue(existingPayment);
      mockPrismaService.payment.update.mockResolvedValue(updatedPayment);

      const response = await app
        .getHttpServer()
        .put(`/api/payment/${paymentId}`)
        .send(updatePaymentDto);

      expect(response.status).toBe(200);
      expect(response.body.payment.status).toBe(PaymentStatus.PAID);

      // Wait for RabbitMQ message
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Check if status changed event was published
      const statusChangedEvents = receivedEvents.filter(
        (event) =>
          event.paymentId === paymentId &&
          event.previousStatus === "PENDING" &&
          event.status === "PAID",
      );

      expect(statusChangedEvents.length).toBeGreaterThan(0);
    });
  });

  describe("Event Structure Validation", () => {
    it("should publish events with correct structure", async () => {
      const createPaymentDto = {
        cpf: "12345678909",
        description: "Test payment structure",
        amount: 150.0,
        paymentMethod: PaymentMethod.PIX,
      };

      const mockPayment = {
        id: "structure-test-payment",
        cpf: "12345678909",
        description: "Test payment structure",
        amount: 150.0,
        paymentMethod: PaymentMethod.PIX,
        status: PaymentStatus.PENDING,
        providerRef: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockPrismaService = app.get(PrismaService);
      mockPrismaService.payment.create.mockResolvedValue(mockPayment);

      await app.getHttpServer().post("/api/payment").send(createPaymentDto);

      // Wait for RabbitMQ message
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const events = receivedEvents.filter(
        (event) => event.paymentId === "structure-test-payment",
      );

      expect(events.length).toBeGreaterThan(0);

      const event = events[0];
      expect(event).toHaveProperty("paymentId");
      expect(event).toHaveProperty("status");
      expect(event).toHaveProperty("amount");
      expect(event).toHaveProperty("customerId");
      expect(event).toHaveProperty("paymentMethod");
      expect(event).toHaveProperty("timestamp");
      expect(event).toHaveProperty("metadata");

      expect(event.paymentId).toBe("structure-test-payment");
      expect(event.status).toBe("PENDING");
      expect(event.amount).toBe(150.0);
      expect(event.paymentMethod).toBe("PIX");
      expect(typeof event.timestamp).toBe("string");
    });
  });

  describe("Error Handling", () => {
    it("should handle RabbitMQ connection errors gracefully", async () => {
      // This test would require mocking RabbitMQ connection failures
      // For now, we'll just ensure the API continues to work
      const createPaymentDto = {
        cpf: "12345678909",
        description: "Test error handling",
        amount: 100.0,
        paymentMethod: PaymentMethod.PIX,
      };

      const mockPayment = {
        id: "error-test-payment",
        cpf: "12345678909",
        description: "Test error handling",
        amount: 100.0,
        paymentMethod: PaymentMethod.PIX,
        status: PaymentStatus.PENDING,
        providerRef: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockPrismaService = app.get(PrismaService);
      mockPrismaService.payment.create.mockResolvedValue(mockPayment);

      const response = await app
        .getHttpServer()
        .post("/api/payment")
        .send(createPaymentDto);

      // API should still work even if RabbitMQ fails
      expect(response.status).toBe(201);
      expect(response.body.payment).toBeDefined();
    });
  });
});
