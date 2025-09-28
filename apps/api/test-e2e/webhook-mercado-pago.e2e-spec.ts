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

describe("Mercado Pago Webhook (e2e)", () => {
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

  describe("Mercado Pago Webhook", () => {
    it("should handle approved payment webhook", async () => {
      // Mock Mercado Pago API response
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "preference_123456789",
          init_point:
            "https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=preference_123456789",
        }),
      });

      // Create a payment first
      const paymentData = {
        cpf: "11144477735",
        description: "Teste Webhook Aprovado",
        amount: 150.0,
        paymentMethod: "CREDIT_CARD",
      };

      const idempotencyKey = "test-webhook-approved-123";

      const paymentResponse = await request(app.getHttpServer())
        .post("/api/payment")
        .set("Idempotency-Key", idempotencyKey)
        .send(paymentData)
        .expect(201);

      const paymentId = paymentResponse.body.id;

      // Simulate Mercado Pago webhook for approved payment
      const webhookPayload = {
        id: 123456789,
        live_mode: false,
        type: "payment",
        date_created: new Date().toISOString(),
        data: {
          id: "123456789",
          status: "approved",
          external_reference: paymentId,
          transaction_amount: 150.0,
          currency_id: "BRL",
          payment_method_id: "credit_card",
          date_approved: new Date().toISOString(),
        },
      };

      const webhookResponse = await request(app.getHttpServer())
        .post("/webhook/mercado-pago")
        .send(webhookPayload)
        .expect(200);

      expect(webhookResponse.body).toHaveProperty("status", "success");
      expect(webhookResponse.body).toHaveProperty("message");
    });

    it("should handle rejected payment webhook", async () => {
      // Mock Mercado Pago API response
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "preference_123456790",
          init_point:
            "https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=preference_123456790",
        }),
      });

      // Create a payment first
      const paymentData = {
        cpf: "11144477735",
        description: "Teste Webhook Rejeitado",
        amount: 75.5,
        paymentMethod: "CREDIT_CARD",
      };

      const idempotencyKey = "test-webhook-rejected-456";

      const paymentResponse = await request(app.getHttpServer())
        .post("/api/payment")
        .set("Idempotency-Key", idempotencyKey)
        .send(paymentData)
        .expect(201);

      const paymentId = paymentResponse.body.id;

      // Simulate Mercado Pago webhook for rejected payment
      const webhookPayload = {
        id: 123456790,
        live_mode: false,
        type: "payment",
        date_created: new Date().toISOString(),
        data: {
          id: "123456790",
          status: "rejected",
          external_reference: paymentId,
          transaction_amount: 75.5,
          currency_id: "BRL",
          payment_method_id: "credit_card",
        },
      };

      const webhookResponse = await request(app.getHttpServer())
        .post("/webhook/mercado-pago")
        .send(webhookPayload)
        .expect(200);

      expect(webhookResponse.body).toHaveProperty("status", "success");
    });

    it("should handle pending payment webhook", async () => {
      // Mock Mercado Pago API response
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: "preference_123456791",
          init_point:
            "https://www.mercadopago.com.br/checkout/v1/redirect?pref_id=preference_123456791",
        }),
      });

      // Create a payment first
      const paymentData = {
        cpf: "11144477735",
        description: "Teste Webhook Pendente",
        amount: 300.0,
        paymentMethod: "CREDIT_CARD",
      };

      const idempotencyKey = "test-webhook-pending-789";

      const paymentResponse = await request(app.getHttpServer())
        .post("/api/payment")
        .set("Idempotency-Key", idempotencyKey)
        .send(paymentData)
        .expect(201);

      const paymentId = paymentResponse.body.id;

      // Simulate Mercado Pago webhook for pending payment
      const webhookPayload = {
        id: 123456791,
        live_mode: false,
        type: "payment",
        date_created: new Date().toISOString(),
        data: {
          id: "123456791",
          status: "pending",
          external_reference: paymentId,
          transaction_amount: 300.0,
          currency_id: "BRL",
          payment_method_id: "credit_card",
        },
      };

      const webhookResponse = await request(app.getHttpServer())
        .post("/webhook/mercado-pago")
        .send(webhookPayload)
        .expect(200);

      expect(webhookResponse.body).toHaveProperty("status", "success");
    });

    it("should ignore non-payment webhooks", async () => {
      const webhookPayload = {
        id: 123456792,
        live_mode: false,
        type: "subscription",
        date_created: new Date().toISOString(),
        data: {
          id: "123456792",
          status: "active",
        },
      };

      const webhookResponse = await request(app.getHttpServer())
        .post("/webhook/mercado-pago")
        .send(webhookPayload)
        .expect(200);

      expect(webhookResponse.body).toHaveProperty("status", "ignored");
      expect(webhookResponse.body).toHaveProperty("message");
    });

    it("should handle webhook without external_reference", async () => {
      const webhookPayload = {
        id: 123456793,
        live_mode: false,
        type: "payment",
        date_created: new Date().toISOString(),
        data: {
          id: "123456793",
          status: "approved",
          transaction_amount: 100.0,
          currency_id: "BRL",
        },
      };

      const webhookResponse = await request(app.getHttpServer())
        .post("/webhook/mercado-pago")
        .send(webhookPayload)
        .expect(200);

      expect(webhookResponse.body).toHaveProperty("status", "warning");
      expect(webhookResponse.body).toHaveProperty("message");
    });

    it("should handle invalid webhook payload", async () => {
      const webhookResponse = await request(app.getHttpServer())
        .post("/webhook/mercado-pago")
        .send({})
        .expect(400);

      expect(webhookResponse.body).toHaveProperty("message");
    });

    it("should handle test webhook endpoint", async () => {
      const testPayload = {
        test: true,
        message: "Test webhook",
        timestamp: new Date().toISOString(),
      };

      const webhookResponse = await request(app.getHttpServer())
        .post("/webhook/mercado-pago/test")
        .send(testPayload)
        .expect(200);

      expect(webhookResponse.body).toHaveProperty("status", "success");
      expect(webhookResponse.body).toHaveProperty("message");
      expect(webhookResponse.body).toHaveProperty("received");
    });
  });
});
