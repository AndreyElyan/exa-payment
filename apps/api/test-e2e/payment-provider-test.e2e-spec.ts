import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import {
  INestApplication,
  ValidationPipe,
  BadRequestException,
} from "@nestjs/common";
import { PrismaService } from "../src/infra/db/prisma.service";
import { GlobalExceptionFilter } from "../src/common/filters/global-exception.filter";
import { PaymentController } from "../src/interfaces/controllers/payment.controller";
import { CreatePaymentUseCase } from "../src/application/use-cases/create-payment.use-case";
import { UpdatePaymentUseCase } from "../src/application/use-cases/update-payment.use-case";
import { PrismaPaymentRepository } from "../src/infra/db/prisma-payment.repository";
import { MercadoPagoProvider } from "../src/infra/providers/mercado-pago.provider";
import { PaymentProviderConfigService } from "../src/config/payment-provider.config";
import { IdempotencyService } from "../src/domain/services/idempotency.service";
import { DomainEventService } from "../src/domain/services/domain-event.service";
import { PaymentRepository } from "../src/application/ports/payment.repository.port";
import { PaymentProvider } from "../src/application/ports/payment-provider.port";
import request from "supertest";

describe("Payment Provider Test Integration (e2e) - US8", () => {
  let app: INestApplication;
  let prismaService: PrismaService;

  beforeAll(async () => {
    // Set up environment variables for testing
    process.env.DATABASE_URL =
      process.env.DATABASE_URL ||
      "postgresql://app:app@localhost:5434/payments";

    // Set up Mercado Pago test environment
    process.env.MERCADO_PAGO_ACCESS_TOKEN = "TEST_ACCESS_TOKEN";
    process.env.MERCADO_PAGO_BASE_URL = "https://api.mercadopago.com";
    process.env.MERCADO_PAGO_TIMEOUT = "3000";
    process.env.MERCADO_PAGO_MAX_RETRIES = "3";

    // Mock fetch for Mercado Pago API calls
    global.fetch = vi.fn();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [PaymentController],
      providers: [
        PrismaService,
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
        DomainEventService,
        CreatePaymentUseCase,
        UpdatePaymentUseCase,
        GlobalExceptionFilter,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    prismaService = moduleFixture.get<PrismaService>(PrismaService);

    // Apply the same configuration as main.ts
    app.useGlobalFilters(new GlobalExceptionFilter());
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        exceptionFactory: (errors) => {
          const errorMessages = errors.map((error) => {
            const constraints = Object.values(error.constraints || {});
            return constraints.join(", ");
          });
          return new BadRequestException(errorMessages.join("; "));
        },
      }),
    );

    await app.init();
  });

  beforeEach(async () => {
    // Mock successful Mercado Pago API response
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          id: `mp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          init_point: `https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=mp_${Date.now()}`,
        }),
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe("Basic Provider Integration", () => {
    it("should create CREDIT_CARD payment with provider integration", async () => {
      const paymentData = {
        cpf: "12345678909",
        description: "Provider Integration Test",
        amount: 199.9,
        paymentMethod: "CREDIT_CARD",
      };

      const response = await request(app.getHttpServer())
        .post("/api/payment")
        .set("Idempotency-Key", "test-provider-123")
        .send(paymentData)
        .expect(201);

      expect(response.body).toMatchObject({
        id: expect.any(String),
        status: "PENDING",
        paymentMethod: "CREDIT_CARD",
        cpf: "12345678909",
        description: "Provider Integration Test",
        amount: 199.9,
        providerRef: expect.stringMatching(/^mp_/),
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });

      // Verify database persistence
      const savedPayment = await prismaService.payment.findUnique({
        where: { id: response.body.id },
      });

      expect(savedPayment).toBeDefined();
      expect(savedPayment?.status).toBe("PENDING");
      expect(savedPayment?.providerRef).toMatch(/^mp_/);
    });

    it("should create PIX payment without provider integration", async () => {
      const paymentData = {
        cpf: "12345678909",
        description: "PIX Payment Test",
        amount: 100.0,
        paymentMethod: "PIX",
      };

      const response = await request(app.getHttpServer())
        .post("/api/payment")
        .send(paymentData)
        .expect(201);

      expect(response.body).toMatchObject({
        id: expect.any(String),
        status: "PENDING",
        paymentMethod: "PIX",
        cpf: "12345678909",
        description: "PIX Payment Test",
        amount: 100.0,
        providerRef: null,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });

      // Verify database persistence
      const savedPayment = await prismaService.payment.findUnique({
        where: { id: response.body.id },
      });

      expect(savedPayment).toBeDefined();
      expect(savedPayment?.status).toBe("PENDING");
      expect(savedPayment?.providerRef).toBeNull();
    });
  });

  describe("Idempotency with Provider", () => {
    it("should handle idempotency for CREDIT_CARD payments", async () => {
      const paymentData = {
        cpf: "12345678909",
        description: "Idempotency Test",
        amount: 150.0,
        paymentMethod: "CREDIT_CARD",
      };

      const idempotencyKey = "test-idempotency-123";

      // First call
      const firstResponse = await request(app.getHttpServer())
        .post("/api/payment")
        .set("Idempotency-Key", idempotencyKey)
        .send(paymentData)
        .expect(201);

      // Second call with same key
      const secondResponse = await request(app.getHttpServer())
        .post("/api/payment")
        .set("Idempotency-Key", idempotencyKey)
        .send(paymentData)
        .expect(200);

      expect(firstResponse.body.id).toBe(secondResponse.body.id);
      expect(firstResponse.body.providerRef).toBe(
        secondResponse.body.providerRef,
      );
    });

    it("should handle idempotency conflict", async () => {
      const idempotencyKey = "test-conflict-123";

      const paymentData1 = {
        cpf: "12345678909",
        description: "First Payment",
        amount: 100.0,
        paymentMethod: "CREDIT_CARD",
      };

      const paymentData2 = {
        cpf: "12345678909",
        description: "Second DIFFERENT Payment",
        amount: 200.0,
        paymentMethod: "CREDIT_CARD",
      };

      // First call
      await request(app.getHttpServer())
        .post("/api/payment")
        .set("Idempotency-Key", idempotencyKey)
        .send(paymentData1)
        .expect(201);

      // Second call with same key but different payload
      const response = await request(app.getHttpServer())
        .post("/api/payment")
        .set("Idempotency-Key", idempotencyKey)
        .send(paymentData2)
        .expect(409);

      expect(response.body).toMatchObject({
        message: "IDEMPOTENCY_KEY_CONFLICT",
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle provider timeout gracefully", async () => {
      // Mock timeout response
      (global.fetch as any).mockRejectedValue(new Error("Request timeout"));

      const paymentData = {
        cpf: "12345678909",
        description: "Timeout Test",
        amount: 100.0,
        paymentMethod: "CREDIT_CARD",
      };

      const response = await request(app.getHttpServer())
        .post("/api/payment")
        .set("Idempotency-Key", "test-timeout-123")
        .send(paymentData)
        .expect(503);

      // Should return service unavailable when provider fails
      expect(response.body.message).toBe(
        "Payment processing service unavailable",
      );
    });

    it("should handle provider API errors gracefully", async () => {
      // Mock error response
      (global.fetch as any).mockResolvedValue({
        ok: false,
        status: 400,
        text: () => Promise.resolve("Invalid request"),
      });

      const paymentData = {
        cpf: "12345678909",
        description: "API Error Test",
        amount: 75.5,
        paymentMethod: "CREDIT_CARD",
      };

      const response = await request(app.getHttpServer())
        .post("/api/payment")
        .set("Idempotency-Key", "test-api-error-123")
        .send(paymentData)
        .expect(503);

      // Should return service unavailable when provider fails
      expect(response.body.message).toBe(
        "Payment processing service unavailable",
      );
    });
  });

  describe("Performance Testing", () => {
    it("should handle multiple CREDIT_CARD payments", async () => {
      const startTime = Date.now();
      const responses: any[] = [];

      // 3 sequential CREDIT_CARD requests
      for (let i = 0; i < 3; i++) {
        const response = await request(app.getHttpServer())
          .post("/api/payment")
          .set("Idempotency-Key", `test-performance-${i}-${Date.now()}`)
          .send({
            cpf: "12345678909",
            description: `Performance Test ${i}`,
            amount: 100.0 + i * 10,
            paymentMethod: "CREDIT_CARD",
          })
          .timeout(10000);

        responses.push(response);
      }

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Verify all requests were successful
      expect(responses).toHaveLength(3);
      responses.forEach((response) => {
        expect(response.status).toBe(201);
        expect(response.body.providerRef).toMatch(/^mp_/);
      });

      // Verify performance (total time < 15 seconds for 3 requests)
      expect(totalTime).toBeLessThan(15000);

      console.log(
        `Performance test: 3 CREDIT_CARD requests successful in ${totalTime}ms`,
      );
    });

    it("should handle mixed PIX and CREDIT_CARD payments", async () => {
      const pixPayment = {
        cpf: "12345678909",
        description: "PIX Payment",
        amount: 100.0,
        paymentMethod: "PIX",
      };

      const cardPayment = {
        cpf: "98765432100",
        description: "CREDIT_CARD Payment",
        amount: 200.0,
        paymentMethod: "CREDIT_CARD",
      };

      // PIX payment (no provider integration)
      const pixResponse = await request(app.getHttpServer())
        .post("/api/payment")
        .send(pixPayment)
        .expect(201);

      expect(pixResponse.body.providerRef).toBeNull();
      expect(pixResponse.body.status).toBe("PENDING");

      // CREDIT_CARD payment (with provider integration)
      const cardResponse = await request(app.getHttpServer())
        .post("/api/payment")
        .set("Idempotency-Key", "test-mixed-payments-123")
        .send(cardPayment)
        .expect(201);

      expect(cardResponse.body.providerRef).toMatch(/^mp_/);
      expect(cardResponse.body.status).toBe("PENDING");
    });
  });

  describe("Database Integration", () => {
    it("should persist provider integration data correctly", async () => {
      const paymentData = {
        cpf: "12345678909",
        description: "Database Test",
        amount: 299.9,
        paymentMethod: "CREDIT_CARD",
      };

      const response = await request(app.getHttpServer())
        .post("/api/payment")
        .set("Idempotency-Key", "test-db-123")
        .send(paymentData)
        .expect(201);

      // Verify database persistence
      const savedPayment = await prismaService.payment.findUnique({
        where: { id: response.body.id },
      });

      expect(savedPayment).toBeDefined();
      expect(savedPayment?.status).toBe("PENDING");
      expect(savedPayment?.cpf).toBe("12345678909");
      expect(Number(savedPayment?.amount)).toBe(299.9);
      expect(savedPayment?.providerRef).toMatch(/^mp_/);
      expect(savedPayment?.paymentMethod).toBe("CREDIT_CARD");
    });

    it("should maintain database consistency with multiple payments", async () => {
      const payments = [
        {
          cpf: "12345678909",
          description: "PIX Payment",
          amount: 100.0,
          paymentMethod: "PIX",
        },
        {
          cpf: "12345678909",
          description: "CREDIT_CARD Payment",
          amount: 200.0,
          paymentMethod: "CREDIT_CARD",
        },
      ];

      const responses: any[] = [];

      for (let i = 0; i < payments.length; i++) {
        const payment = payments[i];
        const response = await request(app.getHttpServer())
          .post("/api/payment")
          .set("Idempotency-Key", `test-consistency-${i}-${Date.now()}`)
          .send(payment)
          .expect(201);

        responses.push(response);
      }

      // Verify all payments were created
      expect(responses).toHaveLength(2);

      // Verify database consistency - check only the payments we just created
      const createdPaymentIds = responses.map((r) => r.body.id);
      const createdPayments = await prismaService.payment.findMany({
        where: { id: { in: createdPaymentIds } },
        orderBy: { createdAt: "asc" },
      });

      expect(createdPayments).toHaveLength(2);

      // Verify PIX payment has no providerRef
      const pixPayment = createdPayments.find((p) => p.paymentMethod === "PIX");
      expect(pixPayment?.providerRef).toBeNull();

      // Verify CREDIT_CARD payment has providerRef
      const cardPayment = createdPayments.find(
        (p) => p.paymentMethod === "CREDIT_CARD",
      );
      expect(cardPayment?.providerRef).toMatch(/^mp_/);
    });
  });
});
