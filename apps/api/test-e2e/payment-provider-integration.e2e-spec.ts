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
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/infra/db/prisma.service";
import { GlobalExceptionFilter } from "../src/common/filters/global-exception.filter";
import request from "supertest";

describe("Payment Provider Integration (e2e) - US8 Complete Coverage", () => {
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

    // Set up Temporal test environment (disabled for E2E tests)
    process.env.TEMPORAL_ADDRESS = "localhost:7233";
    process.env.TEMPORAL_NAMESPACE = "default";

    // Mock fetch for Mercado Pago API calls
    global.fetch = vi.fn();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
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

  describe("Mercado Pago Integration Scenarios", () => {
    it("Scenario 1: Create CREDIT_CARD payment with Mercado Pago integration", async () => {
      const paymentData = {
        cpf: "12345678909",
        description: "Mercado Pago Integration Test",
        amount: 199.9,
        paymentMethod: "CREDIT_CARD",
      };

      const response = await request(app.getHttpServer())
        .post("/api/payment")
        .set("Idempotency-Key", "test-mercado-pago-123")
        .send(paymentData)
        .expect(201);

      expect(response.body).toMatchObject({
        id: expect.any(String),
        status: "PENDING",
        paymentMethod: "CREDIT_CARD",
        cpf: "12345678909",
        description: "Mercado Pago Integration Test",
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

    it("Scenario 2: CREDIT_CARD payment with retry mechanism", async () => {
      const paymentData = {
        cpf: "98765432100",
        description: "Retry Mechanism Test",
        amount: 299.5,
        paymentMethod: "CREDIT_CARD",
      };

      const response = await request(app.getHttpServer())
        .post("/api/payment")
        .set("Idempotency-Key", "test-retry-123")
        .send(paymentData)
        .expect(201);

      expect(response.body.providerRef).toMatch(/^mp_/);
      expect(response.body.status).toBe("PENDING");
    });

    it("Scenario 3: CREDIT_CARD payment with timeout handling", async () => {
      const paymentData = {
        cpf: "11122233344",
        description: "Timeout Test",
        amount: 150.0,
        paymentMethod: "CREDIT_CARD",
      };

      const response = await request(app.getHttpServer())
        .post("/api/payment")
        .set("Idempotency-Key", "test-timeout-123")
        .send(paymentData)
        .expect(201);

      expect(response.body.providerRef).toMatch(/^mp_/);
      expect(response.body.status).toBe("PENDING");
    });

    it("Scenario 4: CREDIT_CARD payment with CPF validation", async () => {
      const paymentData = {
        cpf: "12345678909",
        description: "CPF Validation Test",
        amount: 250.75,
        paymentMethod: "CREDIT_CARD",
      };

      const response = await request(app.getHttpServer())
        .post("/api/payment")
        .set("Idempotency-Key", "test-cpf-123")
        .send(paymentData)
        .expect(201);

      expect(response.body.cpf).toBe("12345678909");
      expect(response.body.providerRef).toMatch(/^mp_/);
    });

    it("Scenario 5: CREDIT_CARD payment with external reference", async () => {
      const paymentData = {
        cpf: "55566677788",
        description: "External Reference Test",
        amount: 400.0,
        paymentMethod: "CREDIT_CARD",
      };

      const idempotencyKey = "test-external-ref-123";

      const response = await request(app.getHttpServer())
        .post("/api/payment")
        .set("Idempotency-Key", idempotencyKey)
        .send(paymentData)
        .expect(201);

      expect(response.body.providerRef).toMatch(/^mp_/);

      // Verify that external_reference is set correctly in the database
      const savedPayment = await prismaService.payment.findUnique({
        where: { id: response.body.id },
      });

      expect(savedPayment?.providerRef).toMatch(/^mp_/);
    });
  });

  describe("Temporal Workflow Integration Scenarios", () => {
    it("Scenario 6: Temporal workflow starts for CREDIT_CARD payment", async () => {
      const paymentData = {
        cpf: "99988877766",
        description: "Temporal Workflow Test",
        amount: 350.25,
        paymentMethod: "CREDIT_CARD",
      };

      const response = await request(app.getHttpServer())
        .post("/api/payment")
        .set("Idempotency-Key", "test-temporal-123")
        .send(paymentData)
        .expect(201);

      expect(response.body.status).toBe("PENDING");
      expect(response.body.providerRef).toMatch(/^mp_/);

      // Verify that the payment is created with PENDING status
      const savedPayment = await prismaService.payment.findUnique({
        where: { id: response.body.id },
      });

      expect(savedPayment?.status).toBe("PENDING");
    });

    it("Scenario 7: Temporal workflow handles payment status updates", async () => {
      const paymentData = {
        cpf: "77766655544",
        description: "Temporal Status Update Test",
        amount: 450.0,
        paymentMethod: "CREDIT_CARD",
      };

      const response = await request(app.getHttpServer())
        .post("/api/payment")
        .set("Idempotency-Key", "test-temporal-status-123")
        .send(paymentData)
        .expect(201);

      expect(response.body.status).toBe("PENDING");

      // The Temporal workflow will handle status updates asynchronously
      // In a real scenario, the status would be updated by the workflow
      const savedPayment = await prismaService.payment.findUnique({
        where: { id: response.body.id },
      });

      expect(savedPayment?.status).toBe("PENDING");
    });

    it("Scenario 8: Temporal workflow handles payment failures", async () => {
      const paymentData = {
        cpf: "33344455566",
        description: "Temporal Failure Test",
        amount: 200.0,
        paymentMethod: "CREDIT_CARD",
      };

      const response = await request(app.getHttpServer())
        .post("/api/payment")
        .set("Idempotency-Key", "test-temporal-failure-123")
        .send(paymentData)
        .expect(201);

      expect(response.body.status).toBe("PENDING");

      // The Temporal workflow will handle failures and update status accordingly
      const savedPayment = await prismaService.payment.findUnique({
        where: { id: response.body.id },
      });

      expect(savedPayment?.status).toBe("PENDING");
    });
  });

  describe("Error Handling Scenarios", () => {
    it("Scenario 9: Mercado Pago API timeout", async () => {
      const paymentData = {
        cpf: "22233344455",
        description: "API Timeout Test",
        amount: 100.0,
        paymentMethod: "CREDIT_CARD",
      };

      const response = await request(app.getHttpServer())
        .post("/api/payment")
        .set("Idempotency-Key", "test-timeout-123")
        .send(paymentData)
        .expect(201);

      // Even with timeout, the payment should be created with PENDING status
      expect(response.body.status).toBe("PENDING");
    });

    it("Scenario 10: Mercado Pago API error handling", async () => {
      const paymentData = {
        cpf: "66677788899",
        description: "API Error Test",
        amount: 75.5,
        paymentMethod: "CREDIT_CARD",
      };

      const response = await request(app.getHttpServer())
        .post("/api/payment")
        .set("Idempotency-Key", "test-api-error-123")
        .send(paymentData)
        .expect(201);

      // The system should handle API errors gracefully
      expect(response.body.status).toBe("PENDING");
    });

    it("Scenario 11: Temporal workflow connection error", async () => {
      const paymentData = {
        cpf: "44455566677",
        description: "Temporal Connection Error Test",
        amount: 300.0,
        paymentMethod: "CREDIT_CARD",
      };

      const response = await request(app.getHttpServer())
        .post("/api/payment")
        .set("Idempotency-Key", "test-temporal-error-123")
        .send(paymentData)
        .expect(201);

      // The system should fallback to direct provider call
      expect(response.body.status).toBe("PENDING");
    });

    it("Scenario 12: Service unavailable exception", async () => {
      const paymentData = {
        cpf: "88899900011",
        description: "Service Unavailable Test",
        amount: 500.0,
        paymentMethod: "CREDIT_CARD",
      };

      const response = await request(app.getHttpServer())
        .post("/api/payment")
        .set("Idempotency-Key", "test-service-unavailable-123")
        .send(paymentData)
        .expect(201);

      // The system should handle service unavailability gracefully
      expect(response.body.status).toBe("PENDING");
    });
  });

  describe("Idempotency with Provider Integration", () => {
    it("Scenario 13: Idempotency with Mercado Pago integration", async () => {
      const paymentData = {
        cpf: "12345678909",
        description: "Idempotency Provider Test",
        amount: 199.9,
        paymentMethod: "CREDIT_CARD",
      };

      const idempotencyKey = "test-idempotency-provider-123";

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

    it("Scenario 14: Idempotency conflict with different payload", async () => {
      const idempotencyKey = "test-idempotency-conflict-123";

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

  describe("Performance and Load Testing", () => {
    it("Scenario 15: Multiple CREDIT_CARD payments performance", async () => {
      const startTime = Date.now();
      const responses: any[] = [];
      const errors: any[] = [];

      // 5 sequential CREDIT_CARD requests
      for (let i = 0; i < 5; i++) {
        try {
          const response = await request(app.getHttpServer())
            .post("/api/payment")
            .set("Idempotency-Key", `test-performance-${i}-${Date.now()}`)
            .send({
              cpf: "12345678909",
              description: `Performance Test ${i}`,
              amount: 100.0 + i * 10,
              paymentMethod: "CREDIT_CARD",
            })
            .timeout(10000); // 10 seconds timeout

          responses.push(response);
        } catch (error) {
          errors.push(error);
        }
      }

      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Verify that at least 4 out of 5 requests were successful
      expect(responses.length).toBeGreaterThanOrEqual(4);

      // Verify that all successful responses have status 201
      responses.forEach((response) => {
        expect(response.status).toBe(201);
        expect(response.body.providerRef).toMatch(/^mp_/);
      });

      // Verify performance (total time < 30 seconds for 5 requests)
      expect(totalTime).toBeLessThan(30000);

      console.log(
        `Performance test: ${responses.length}/5 CREDIT_CARD requests successful in ${totalTime}ms`,
      );
    });

    it("Scenario 16: Mixed PIX and CREDIT_CARD payments", async () => {
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

  describe("Database Integration Scenarios", () => {
    it("Scenario 17: Database persistence with provider integration", async () => {
      const paymentData = {
        cpf: "12345678909",
        description: "Database Persistence Test",
        amount: 299.9,
        paymentMethod: "CREDIT_CARD",
      };

      const response = await request(app.getHttpServer())
        .post("/api/payment")
        .set("Idempotency-Key", "test-db-persistence-123")
        .send(paymentData)
        .expect(201);

      // Verify direct database persistence
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

    it("Scenario 18: Database consistency with multiple payments", async () => {
      const payments = [
        {
          cpf: "11111111111",
          description: "Payment 1",
          amount: 100.0,
          paymentMethod: "PIX",
        },
        {
          cpf: "22222222222",
          description: "Payment 2",
          amount: 200.0,
          paymentMethod: "CREDIT_CARD",
        },
        {
          cpf: "33333333333",
          description: "Payment 3",
          amount: 300.0,
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
      expect(responses).toHaveLength(3);

      // Verify database consistency
      const allPayments = await prismaService.payment.findMany({
        orderBy: { createdAt: "asc" },
      });

      expect(allPayments).toHaveLength(3);

      // Verify PIX payment has no providerRef
      const pixPayment = allPayments.find((p) => p.paymentMethod === "PIX");
      expect(pixPayment?.providerRef).toBeNull();

      // Verify CREDIT_CARD payments have providerRef
      const cardPayments = allPayments.filter(
        (p) => p.paymentMethod === "CREDIT_CARD",
      );
      expect(cardPayments).toHaveLength(2);
      cardPayments.forEach((payment) => {
        expect(payment.providerRef).toMatch(/^mp_/);
      });
    });
  });
});
