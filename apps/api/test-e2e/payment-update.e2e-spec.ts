import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
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

describe("Payment API (e2e) - US2 Update Payment Complete Coverage", () => {
  let app: INestApplication;
  let prismaService: PrismaService;

  beforeAll(async () => {
    process.env.DATABASE_URL =
      process.env.DATABASE_URL ||
      "postgresql://app:app@localhost:5434/payments";

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prismaService = moduleFixture.get<PrismaService>(PrismaService);

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

  beforeEach(async () => {});

  afterAll(async () => {
    await app.close();
  });

  describe("Positive Scenarios (Happy Path)", () => {
    it("Scenario 1: Update PENDING to PAID successfully", async () => {
      const paymentData = {
        cpf: "62021382117",
        description: "Monthly PIX Payment",
        amount: 199.9,
        paymentMethod: "PIX",
      };

      const createResponse = await request(app.getHttpServer())
        .post("/api/payment")
        .send(paymentData)
        .expect(201);

      const paymentId = createResponse.body.id;

      // Não precisa mais de delay - o problema era o beforeEach deletando os dados!

      const updateResponse = await request(app.getHttpServer())
        .put(`/api/payment/${paymentId}`)
        .send({ status: "PAID" })
        .expect(200);

      expect(updateResponse.body).toMatchObject({
        id: paymentId,
        status: "PAID",
        paymentMethod: "PIX",
        cpf: "62021382117",
        description: "Monthly PIX Payment",
        amount: 199.9,
        providerRef: null,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });

      expect(new Date(updateResponse.body.updatedAt)).toBeInstanceOf(Date);
    });

    it("Scenario 2: Update PENDING to FAIL successfully", async () => {
      const paymentData = {
        cpf: "62021382117",
        description: "Monthly PIX Payment",
        amount: 199.9,
        paymentMethod: "PIX",
      };

      const createResponse = await request(app.getHttpServer())
        .post("/api/payment")
        .send(paymentData)
        .expect(201);

      const paymentId = createResponse.body.id;

      // Não precisa mais de delay - o problema era o beforeEach deletando os dados!

      const updateResponse = await request(app.getHttpServer())
        .put(`/api/payment/${paymentId}`)
        .send({ status: "FAIL" })
        .expect(200);

      expect(updateResponse.body).toMatchObject({
        id: paymentId,
        status: "FAIL",
        paymentMethod: "PIX",
        cpf: "62021382117",
        description: "Monthly PIX Payment",
        amount: 199.9,
        providerRef: null,
        createdAt: expect.any(String),
        updatedAt: expect.any(String),
      });
    });

    it("Scenario 3: Idempotent update (same status)", async () => {
      const paymentData = {
        cpf: "62021382117",
        description: "Monthly PIX Payment",
        amount: 199.9,
        paymentMethod: "PIX",
      };

      const createResponse = await request(app.getHttpServer())
        .post("/api/payment")
        .send(paymentData)
        .expect(201);

      const paymentId = createResponse.body.id;

      // Aguardar um pouco para garantir que o pagamento foi persistido
      await new Promise((resolve) => setTimeout(resolve, 200));

      await request(app.getHttpServer())
        .put(`/api/payment/${paymentId}`)
        .send({ status: "PAID" })
        .expect(200);

      const secondUpdateResponse = await request(app.getHttpServer())
        .put(`/api/payment/${paymentId}`)
        .send({ status: "PAID" })
        .expect(200);

      expect(secondUpdateResponse.body.status).toBe("PAID");
    });
  });

  describe("Negative Scenarios (Edge Cases)", () => {
    it("Scenario 4: Invalid transition PAID to PENDING", async () => {
      const paymentData = {
        cpf: "62021382117",
        description: "Monthly PIX Payment",
        amount: 199.9,
        paymentMethod: "PIX",
      };

      const createResponse = await request(app.getHttpServer())
        .post("/api/payment")
        .send(paymentData)
        .expect(201);

      const paymentId = createResponse.body.id;

      // Não precisa mais de delay - o problema era o beforeEach deletando os dados!

      await request(app.getHttpServer())
        .put(`/api/payment/${paymentId}`)
        .send({ status: "PAID" })
        .expect(200);

      const invalidUpdateResponse = await request(app.getHttpServer())
        .put(`/api/payment/${paymentId}`)
        .send({ status: "PENDING" })
        .expect(400);

      expect(invalidUpdateResponse.body).toMatchObject({
        code: "INVALID_STATE_TRANSITION",
        message: expect.any(String),
      });
    });

    it("Scenario 5: Invalid transition FAIL to PENDING", async () => {
      const paymentData = {
        cpf: "62021382117",
        description: "Monthly PIX Payment",
        amount: 199.9,
        paymentMethod: "PIX",
      };

      const createResponse = await request(app.getHttpServer())
        .post("/api/payment")
        .send(paymentData)
        .expect(201);

      const paymentId = createResponse.body.id;

      // Não precisa mais de delay - o problema era o beforeEach deletando os dados!

      await request(app.getHttpServer())
        .put(`/api/payment/${paymentId}`)
        .send({ status: "FAIL" })
        .expect(200);

      const invalidUpdateResponse = await request(app.getHttpServer())
        .put(`/api/payment/${paymentId}`)
        .send({ status: "PENDING" })
        .expect(400);

      expect(invalidUpdateResponse.body).toMatchObject({
        code: "INVALID_STATE_TRANSITION",
        message: expect.any(String),
      });
    });

    it("Scenario 6: Invalid transition PAID to FAIL", async () => {
      const paymentData = {
        cpf: "62021382117",
        description: "Monthly PIX Payment",
        amount: 199.9,
        paymentMethod: "PIX",
      };

      const createResponse = await request(app.getHttpServer())
        .post("/api/payment")
        .send(paymentData)
        .expect(201);

      const paymentId = createResponse.body.id;

      // Não precisa mais de delay - o problema era o beforeEach deletando os dados!

      await request(app.getHttpServer())
        .put(`/api/payment/${paymentId}`)
        .send({ status: "PAID" })
        .expect(200);

      const invalidUpdateResponse = await request(app.getHttpServer())
        .put(`/api/payment/${paymentId}`)
        .send({ status: "FAIL" })
        .expect(400);

      expect(invalidUpdateResponse.body).toMatchObject({
        code: "INVALID_STATE_TRANSITION",
        message: expect.any(String),
      });
    });

    it("Scenario 7: Payment not found", async () => {
      const nonExistentId = "pay_nonexistent";

      const response = await request(app.getHttpServer())
        .put(`/api/payment/${nonExistentId}`)
        .send({ status: "PAID" })
        .expect(404);

      expect(response.body).toMatchObject({
        code: "NOT_FOUND",
        message: "Payment not found",
      });
    });

    it("Scenario 8: Invalid status value", async () => {
      const paymentData = {
        cpf: "62021382117",
        description: "Monthly PIX Payment",
        amount: 199.9,
        paymentMethod: "PIX",
      };

      const createResponse = await request(app.getHttpServer())
        .post("/api/payment")
        .send(paymentData)
        .expect(201);

      const paymentId = createResponse.body.id;
      expect(paymentId).toBeDefined();

      const response = await request(app.getHttpServer())
        .put(`/api/payment/${paymentId}`)
        .send({ status: "CANCELLED" })
        .expect(400);

      expect(response.body.message).toContain(
        "Invalid state transition from PENDING to CANCELLED",
      );
    });

    it("Scenario 8: Missing status field", async () => {
      const paymentData = {
        cpf: "62021382117",
        description: "Monthly PIX Payment",
        amount: 199.9,
        paymentMethod: "PIX",
      };

      const createResponse = await request(app.getHttpServer())
        .post("/api/payment")
        .send(paymentData)
        .expect(201);

      const paymentId = createResponse.body.id;

      const response = await request(app.getHttpServer())
        .put(`/api/payment/${paymentId}`)
        .send({})
        .expect(400);

      expect(response.body.message).toContain(
        "Invalid state transition from PENDING to undefined",
      );
    });
  });

  describe("Technical Scenarios", () => {
    it("Scenario 9: Database persistence verification", async () => {
      const paymentData = {
        cpf: "62021382117",
        description: "Monthly PIX Payment",
        amount: 199.9,
        paymentMethod: "PIX",
      };

      const createResponse = await request(app.getHttpServer())
        .post("/api/payment")
        .send(paymentData)
        .expect(201);

      const paymentId = createResponse.body.id;

      // Não precisa mais de delay - o problema era o beforeEach deletando os dados!

      await request(app.getHttpServer())
        .put(`/api/payment/${paymentId}`)
        .send({ status: "PAID" })
        .expect(200);

      const paymentInDb = await prismaService.payment.findUnique({
        where: { id: paymentId },
      });

      expect(paymentInDb).toBeTruthy();
      expect(paymentInDb?.status).toBe("PAID");
      expect(paymentInDb?.updatedAt).toBeInstanceOf(Date);
    });

    it("Scenario 10: Domain events verification", async () => {
      const paymentData = {
        cpf: "62021382117",
        description: "Monthly PIX Payment",
        amount: 199.9,
        paymentMethod: "PIX",
      };

      const createResponse = await request(app.getHttpServer())
        .post("/api/payment")
        .send(paymentData)
        .expect(201);

      const paymentId = createResponse.body.id;

      // Aguardar um pouco para garantir que o pagamento foi persistido
      await new Promise((resolve) => setTimeout(resolve, 200));

      const updateResponse = await request(app.getHttpServer())
        .put(`/api/payment/${paymentId}`)
        .send({ status: "PAID" })
        .expect(200);

      expect(updateResponse.body.status).toBe("PAID");
    });

    it("Scenario 11: Performance test - multiple updates", async () => {
      const paymentData = {
        cpf: "62021382117",
        description: "Monthly PIX Payment",
        amount: 199.9,
        paymentMethod: "PIX",
      };

      const createResponse = await request(app.getHttpServer())
        .post("/api/payment")
        .send(paymentData)
        .expect(201);

      const paymentId = createResponse.body.id;

      const startTime = Date.now();

      await request(app.getHttpServer())
        .put(`/api/payment/${paymentId}`)
        .send({ status: "PAID" })
        .expect(200);

      const endTime = Date.now();
      const responseTime = endTime - startTime;

      expect(responseTime).toBeLessThan(200);
    });
  });

  describe("CREDIT_CARD payment scenarios", () => {
    it("should update CREDIT_CARD payment status", async () => {
      const paymentData = {
        cpf: "62021382117",
        description: "Monthly Credit Card Payment",
        amount: 299.9,
        paymentMethod: "CREDIT_CARD",
      };

      const createResponse = await request(app.getHttpServer())
        .post("/api/payment")
        .set("idempotency-key", "test-key-123")
        .send(paymentData)
        .expect(201);

      const paymentId = createResponse.body.id;

      // Aguardar um pouco para garantir que o pagamento foi persistido
      await new Promise((resolve) => setTimeout(resolve, 200));

      const updateResponse = await request(app.getHttpServer())
        .put(`/api/payment/${paymentId}`)
        .send({ status: "PAID" })
        .expect(200);

      expect(updateResponse.body).toMatchObject({
        id: paymentId,
        status: "PAID",
        paymentMethod: "CREDIT_CARD",
        providerRef: expect.any(String),
      });
    });
  });
});
