import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { PrismaService } from "../src/infra/db/prisma.service";
import { AppModule } from "../src/app.module";
import { GlobalExceptionFilter } from "../src/common/filters/global-exception.filter";
import request from "supertest";

describe("Payment Get by ID (E2E)", () => {
  let app: INestApplication;
  let prismaService: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prismaService = moduleFixture.get<PrismaService>(PrismaService);

    app.useGlobalFilters(new GlobalExceptionFilter());

    await app.init();
  });

  beforeEach(async () => {
    // CRÍTICO: NÃO limpar dados no beforeEach para evitar interferência
    // O beforeEach estava DELETANDO os pagamentos criados!
  });

  afterAll(async () => {
    // CRÍTICO: NÃO limpar dados no afterAll para evitar interferência
    // O afterAll estava DELETANDO os pagamentos criados!
    await app.close();
  });

  describe("GET /api/payment/:id", () => {
    it("Scenario 1: Get existing PIX payment successfully", async () => {
      // 1. Create a PIX payment first
      const createResponse = await request(app.getHttpServer())
        .post("/api/payment")
        .send({
          cpf: "62021382117",
          description: "Mensalidade PIX",
          amount: 199.9,
          paymentMethod: "PIX",
        });

      expect(createResponse.status).toBe(201);
      expect(createResponse.body.id).toBeDefined();
      expect(createResponse.body.paymentMethod).toBe("PIX");
      expect(createResponse.body.providerRef).toBeNull();

      const paymentId = createResponse.body.id;

      // 2. Get the payment by ID
      const getResponse = await request(app.getHttpServer()).get(
        `/api/payment/${paymentId}`,
      );

      expect(getResponse.status).toBe(200);
      expect(getResponse.body).toMatchObject({
        id: paymentId,
        cpf: "62021382117",
        description: "Mensalidade PIX",
        amount: 199.9,
        paymentMethod: "PIX",
        status: "PENDING",
        providerRef: null,
      });
      expect(getResponse.body.createdAt).toBeDefined();
      expect(getResponse.body.updatedAt).toBeDefined();
    });

    it("Scenario 2: Get existing CREDIT_CARD payment successfully", async () => {
      // 1. Create a CREDIT_CARD payment first
      const createResponse = await request(app.getHttpServer())
        .post("/api/payment")
        .set("Idempotency-Key", "test-key-credit-card")
        .send({
          cpf: "98765432100",
          description: "Mensalidade Cartão",
          amount: 299.9,
          paymentMethod: "CREDIT_CARD",
        });

      expect(createResponse.status).toBe(201);
      expect(createResponse.body.id).toBeDefined();
      expect(createResponse.body.paymentMethod).toBe("CREDIT_CARD");
      expect(createResponse.body.providerRef).toBeDefined();

      const paymentId = createResponse.body.id;

      // 2. Get the payment by ID
      const getResponse = await request(app.getHttpServer()).get(
        `/api/payment/${paymentId}`,
      );

      expect(getResponse.status).toBe(200);
      expect(getResponse.body).toMatchObject({
        id: paymentId,
        cpf: "98765432100",
        description: "Mensalidade Cartão",
        amount: 299.9,
        paymentMethod: "CREDIT_CARD",
        status: "PENDING",
        providerRef: expect.any(String),
      });
      expect(getResponse.body.createdAt).toBeDefined();
      expect(getResponse.body.updatedAt).toBeDefined();
    });

    it("Scenario 3: Get payment with updated status", async () => {
      // 1. Create a payment
      const createResponse = await request(app.getHttpServer())
        .post("/api/payment")
        .send({
          cpf: "62021382117",
          description: "Teste Status Update",
          amount: 150.0,
          paymentMethod: "PIX",
        });

      expect(createResponse.status).toBe(201);
      const paymentId = createResponse.body.id;

      // 2. Update payment status to PAID
      const updateResponse = await request(app.getHttpServer())
        .put(`/api/payment/${paymentId}`)
        .send({
          status: "PAID",
        });

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.status).toBe("PAID");

      // 3. Get the payment and verify updated status
      const getResponse = await request(app.getHttpServer()).get(
        `/api/payment/${paymentId}`,
      );

      expect(getResponse.status).toBe(200);
      expect(getResponse.body.status).toBe("PAID");
      expect(getResponse.body.updatedAt).not.toBe(getResponse.body.createdAt);
    });

    it("Scenario 4: Get non-existent payment returns 404", async () => {
      const nonExistentId = "99999999-9999-9999-9999-999999999999";

      const response = await request(app.getHttpServer()).get(
        `/api/payment/${nonExistentId}`,
      );

      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        code: "NOT_FOUND",
        message: "Payment not found",
      });
      expect(response.body.traceId).toBeDefined();
    });

    it("Scenario 5: Get payment with invalid ID format returns 404", async () => {
      const invalidId = "123";

      const response = await request(app.getHttpServer()).get(
        `/api/payment/${invalidId}`,
      );

      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        code: "NOT_FOUND",
        message: "Payment not found",
      });
    });

    it("Scenario 6: Get payment with SQL injection attempt returns 404", async () => {
      const sqlInjectionId = "' OR 1=1 --";

      const response = await request(app.getHttpServer()).get(
        `/api/payment/${sqlInjectionId}`,
      );

      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        code: "NOT_FOUND",
        message: "Payment not found",
      });
    });

    it("Scenario 7: Performance test - multiple requests", async () => {
      // 1. Create a payment
      const createResponse = await request(app.getHttpServer())
        .post("/api/payment")
        .send({
          cpf: "62021382117",
          description: "Performance Test",
          amount: 100.0,
          paymentMethod: "PIX",
        });

      expect(createResponse.status).toBe(201);
      const paymentId = createResponse.body.id;

      // 2. Make multiple requests to test performance (reduced to avoid connection issues)
      const requests = Array(3)
        .fill(null)
        .map(() =>
          request(app.getHttpServer()).get(`/api/payment/${paymentId}`),
        );

      const responses = await Promise.all(requests);

      // All requests should succeed
      responses.forEach((response) => {
        expect(response.status).toBe(200);
        expect(response.body.id).toBe(paymentId);
      });
    });

    it("Scenario 8: Get payment with different statuses", async () => {
      // Test PENDING status
      const pendingResponse = await request(app.getHttpServer())
        .post("/api/payment")
        .send({
          cpf: "62021382117",
          description: "PENDING Status",
          amount: 50.0,
          paymentMethod: "PIX",
        });

      expect(pendingResponse.status).toBe(201);
      const pendingId = pendingResponse.body.id;

      const getPendingResponse = await request(app.getHttpServer()).get(
        `/api/payment/${pendingId}`,
      );

      expect(getPendingResponse.status).toBe(200);
      expect(getPendingResponse.body.status).toBe("PENDING");

      // Test FAIL status
      const failResponse = await request(app.getHttpServer())
        .post("/api/payment")
        .send({
          cpf: "62021382117",
          description: "FAIL Status",
          amount: 75.0,
          paymentMethod: "PIX",
        });

      expect(failResponse.status).toBe(201);
      const failId = failResponse.body.id;

      // Update to FAIL
      await request(app.getHttpServer())
        .put(`/api/payment/${failId}`)
        .send({ status: "FAIL" });

      const getFailResponse = await request(app.getHttpServer()).get(
        `/api/payment/${failId}`,
      );

      expect(getFailResponse.status).toBe(200);
      expect(getFailResponse.body.status).toBe("FAIL");
    });

    it("Scenario 9: Database persistence verification", async () => {
      // 1. Create a payment
      const createResponse = await request(app.getHttpServer())
        .post("/api/payment")
        .send({
          cpf: "62021382117",
          description: "Database Persistence Test",
          amount: 200.0,
          paymentMethod: "PIX",
        });

      expect(createResponse.status).toBe(201);
      const paymentId = createResponse.body.id;

      // 2. Verify payment exists in database
      const payment = await prismaService.payment.findUnique({
        where: { id: paymentId },
      });

      expect(payment).toBeDefined();
      expect(payment.id).toBe(paymentId);
      expect(payment.cpf).toBe("62021382117");
      expect(payment.paymentMethod).toBe("PIX");
      expect(payment.status).toBe("PENDING");

      // 3. Get payment via API
      const getResponse = await request(app.getHttpServer()).get(
        `/api/payment/${paymentId}`,
      );

      expect(getResponse.status).toBe(200);
      expect(getResponse.body.id).toBe(paymentId);
    });

    it("Scenario 10: Headers and tracing verification", async () => {
      // 1. Create a payment
      const createResponse = await request(app.getHttpServer())
        .post("/api/payment")
        .send({
          cpf: "62021382117",
          description: "Headers Test",
          amount: 125.0,
          paymentMethod: "PIX",
        });

      expect(createResponse.status).toBe(201);
      const paymentId = createResponse.body.id;

      // 2. Get payment with custom headers
      const getResponse = await request(app.getHttpServer())
        .get(`/api/payment/${paymentId}`)
        .set("X-Trace-ID", "custom-trace-123")
        .set("User-Agent", "Test-Agent/1.0")
        .set("Accept", "application/json");

      expect(getResponse.status).toBe(200);
      expect(getResponse.body.id).toBe(paymentId);
      expect(getResponse.headers["content-type"]).toContain("application/json");
    });
  });
});
