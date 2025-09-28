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
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/infra/db/prisma.service";
import { GlobalExceptionFilter } from "../src/common/filters/global-exception.filter";
import request from "supertest";

describe("Payment Temporal Credit Card Flow (e2e)", () => {
  let app: INestApplication;
  let prismaService: PrismaService;

  beforeAll(async () => {
    // Set up environment variables for testing
    process.env.DATABASE_URL =
      process.env.DATABASE_URL ||
      "postgresql://app:app@localhost:5434/payments";

    // Set up Temporal environment
    process.env.TEMPORAL_ADDRESS = "localhost:7233";
    process.env.TEMPORAL_NAMESPACE = "default";

    // Set up Mercado Pago test environment
    process.env.MERCADO_PAGO_ACCESS_TOKEN = "TEST_ACCESS_TOKEN";
    process.env.MERCADO_PAGO_BASE_URL = "https://api.mercadopago.com";
    process.env.MERCADO_PAGO_TIMEOUT = "3000";
    process.env.MERCADO_PAGO_MAX_RETRIES = "3";

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
      }),
    );

    await app.init();
  });

  beforeEach(async () => {
    // Clean database before each test
    await prismaService.payment.deleteMany();
    await prismaService.idempotencyKey.deleteMany();

    // Reset fetch mock
    vi.clearAllMocks();
  });

  afterAll(async () => {
    await prismaService.payment.deleteMany();
    await prismaService.idempotencyKey.deleteMany();
    await prismaService.$disconnect();
    await app.close();
  });

  describe("CREDIT_CARD payment with Temporal workflow", () => {
    it("should create payment and start Temporal workflow", async () => {
      // Mock Mercado Pago API response
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "preference_123456789",
          init_point:
            "https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=preference_123456789",
        }),
      });

      const paymentData = {
        cpf: "11144477735",
        description: "Teste Temporal Cartão",
        amount: 100.5,
        paymentMethod: "CREDIT_CARD",
      };

      const idempotencyKey = "test-temporal-123";

      const response = await request(app.getHttpServer())
        .post("/api/payment")
        .set("Idempotency-Key", idempotencyKey)
        .send(paymentData)
        .expect(201);

      expect(response.body).toHaveProperty("id");
      expect(response.body).toHaveProperty("status", "PENDING");
      expect(response.body).toHaveProperty("paymentMethod", "CREDIT_CARD");
      expect(response.body).toHaveProperty("cpf", "11144477735");
      expect(response.body).toHaveProperty("amount", 100.5);
      expect(response.body).toHaveProperty(
        "description",
        "Teste Temporal Cartão",
      );

      // Verify payment was saved in database
      const savedPayment = await prismaService.payment.findUnique({
        where: { id: response.body.id },
      });

      expect(savedPayment).toBeTruthy();
      expect(savedPayment?.status).toBe("PENDING");
      expect(savedPayment?.paymentMethod).toBe("CREDIT_CARD");

      // Verify idempotency key was stored
      const idempotencyRecord = await prismaService.idempotencyKey.findUnique({
        where: { key: idempotencyKey },
      });

      expect(idempotencyRecord).toBeTruthy();
      expect(idempotencyRecord?.paymentId).toBe(response.body.id);
    });

    it("should handle Temporal workflow failure and fallback to direct provider", async () => {
      // Mock Mercado Pago API response for fallback
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "preference_fallback_123",
          init_point:
            "https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=preference_fallback_123",
        }),
      });

      const paymentData = {
        cpf: "11144477735",
        description: "Teste Fallback Temporal",
        amount: 200.75,
        paymentMethod: "CREDIT_CARD",
      };

      const idempotencyKey = "test-fallback-temporal-456";

      const response = await request(app.getHttpServer())
        .post("/api/payment")
        .set("Idempotency-Key", idempotencyKey)
        .send(paymentData)
        .expect(201);

      expect(response.body).toHaveProperty("id");
      expect(response.body).toHaveProperty("status", "PENDING");
      expect(response.body).toHaveProperty("paymentMethod", "CREDIT_CARD");

      // Verify payment was saved in database
      const savedPayment = await prismaService.payment.findUnique({
        where: { id: response.body.id },
      });

      expect(savedPayment).toBeTruthy();
      expect(savedPayment?.status).toBe("PENDING");
    });

    it("should require Idempotency-Key for CREDIT_CARD payments", async () => {
      const paymentData = {
        cpf: "11144477735",
        description: "Teste sem Idempotency",
        amount: 50.25,
        paymentMethod: "CREDIT_CARD",
      };

      const response = await request(app.getHttpServer())
        .post("/api/payment")
        .send(paymentData)
        .expect(400);

      expect(response.body.message).toContain(
        "Idempotency-Key é obrigatório para CREDIT_CARD",
      );
    });

    it("should handle duplicate Idempotency-Key correctly", async () => {
      const paymentData = {
        cpf: "12345678900",
        description: "Teste Duplicata",
        amount: 75.0,
        paymentMethod: "CREDIT_CARD",
      };

      const idempotencyKey = "test-duplicate-789";

      // First request
      const firstResponse = await request(app.getHttpServer())
        .post("/api/payment")
        .set("Idempotency-Key", idempotencyKey)
        .send(paymentData)
        .expect(201);

      // Second request with same Idempotency-Key should return same payment
      const secondResponse = await request(app.getHttpServer())
        .post("/api/payment")
        .set("Idempotency-Key", idempotencyKey)
        .send(paymentData)
        .expect(200);

      expect(firstResponse.body.id).toBe(secondResponse.body.id);
      expect(secondResponse.body.isNew).toBe(false);
    });
  });

  describe("PIX payment (should not use Temporal)", () => {
    it("should process PIX payment without Temporal workflow", async () => {
      const paymentData = {
        cpf: "11144477735",
        description: "Teste PIX",
        amount: 150.0,
        paymentMethod: "PIX",
      };

      const response = await request(app.getHttpServer())
        .post("/api/payment")
        .send(paymentData)
        .expect(201);

      expect(response.body).toHaveProperty("id");
      expect(response.body).toHaveProperty("status", "PENDING");
      expect(response.body).toHaveProperty("paymentMethod", "PIX");

      // Verify payment was saved in database
      const savedPayment = await prismaService.payment.findUnique({
        where: { id: response.body.id },
      });

      expect(savedPayment).toBeTruthy();
      expect(savedPayment?.status).toBe("PENDING");
      expect(savedPayment?.paymentMethod).toBe("PIX");
    });
  });
});
