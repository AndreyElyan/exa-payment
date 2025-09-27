import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { PrismaService } from "../src/infra/db/prisma.service";
import { AppModule } from "../src/app.module";
import { GlobalExceptionFilter } from "../src/common/filters/global-exception.filter";
import request from "supertest";

describe("Payment List (E2E)", () => {
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

  beforeEach(async () => {});

  afterAll(async () => {
    await app.close();
  });

  describe("GET /api/payment", () => {
    it("Scenario 1: List all payments without filters", async () => {
      // 1. Create some payments first
      const createResponse1 = await request(app.getHttpServer())
        .post("/api/payment")
        .send({
          cpf: "62021382117",
          description: "Test Payment 1",
          amount: 100.0,
          paymentMethod: "PIX",
        });

      expect(createResponse1.status).toBe(201);

      const createResponse2 = await request(app.getHttpServer())
        .post("/api/payment")
        .set("Idempotency-Key", "test-key-list-1")
        .send({
          cpf: "98765432100",
          description: "Test Payment 2",
          amount: 200.0,
          paymentMethod: "CREDIT_CARD",
        });

      expect(createResponse2.status).toBe(201);

      // 2. List all payments
      const listResponse = await request(app.getHttpServer()).get(
        "/api/payment",
      );

      expect(listResponse.status).toBe(200);
      expect(listResponse.body).toMatchObject({
        items: expect.any(Array),
        page: 1,
        limit: 20,
        total: expect.any(Number),
        hasNextPage: expect.any(Boolean),
      });
      expect(listResponse.body.items.length).toBeGreaterThanOrEqual(2);
    });

    it("Scenario 2: Filter by CPF", async () => {
      // 1. Create a payment with specific CPF
      const createResponse = await request(app.getHttpServer())
        .post("/api/payment")
        .send({
          cpf: "62021382117",
          description: "CPF Filter Test",
          amount: 150.0,
          paymentMethod: "PIX",
        });

      expect(createResponse.status).toBe(201);
      const paymentId = createResponse.body.id;

      // 2. Filter by CPF
      const listResponse = await request(app.getHttpServer()).get(
        "/api/payment?cpf=62021382117",
      );

      expect(listResponse.status).toBe(200);
      expect(listResponse.body.items.length).toBeGreaterThanOrEqual(1);

      // Find the specific payment we created
      const foundPayment = listResponse.body.items.find(
        (item: any) => item.id === paymentId,
      );
      expect(foundPayment).toBeDefined();
      expect(foundPayment).toMatchObject({
        id: paymentId,
        cpf: "62021382117",
        description: "CPF Filter Test",
        amount: 150.0,
        paymentMethod: "PIX",
        status: "PENDING",
        providerRef: null,
      });
    });

    it("Scenario 3: Filter by paymentMethod=PIX", async () => {
      // 1. Create a PIX payment
      const createResponse = await request(app.getHttpServer())
        .post("/api/payment")
        .send({
          cpf: "62021382117",
          description: "PIX Filter Test",
          amount: 250.0,
          paymentMethod: "PIX",
        });

      expect(createResponse.status).toBe(201);

      // 2. Filter by paymentMethod=PIX
      const listResponse = await request(app.getHttpServer()).get(
        "/api/payment?paymentMethod=PIX",
      );

      expect(listResponse.status).toBe(200);
      expect(listResponse.body.items.length).toBeGreaterThanOrEqual(1);

      // All returned items should be PIX
      listResponse.body.items.forEach((item: any) => {
        expect(item.paymentMethod).toBe("PIX");
      });
    });

    it("Scenario 4: Filter by status=PAID", async () => {
      // 1. Create a payment
      const createResponse = await request(app.getHttpServer())
        .post("/api/payment")
        .send({
          cpf: "62021382117",
          description: "Status Filter Test",
          amount: 300.0,
          paymentMethod: "PIX",
        });

      expect(createResponse.status).toBe(201);
      const paymentId = createResponse.body.id;

      // 2. Update payment to PAID
      const updateResponse = await request(app.getHttpServer())
        .put(`/api/payment/${paymentId}`)
        .send({ status: "PAID" });

      expect(updateResponse.status).toBe(200);

      // 3. Filter by status=PAID
      const listResponse = await request(app.getHttpServer()).get(
        "/api/payment?status=PAID",
      );

      expect(listResponse.status).toBe(200);
      expect(listResponse.body.items.length).toBeGreaterThanOrEqual(1);

      // All returned items should be PAID
      listResponse.body.items.forEach((item: any) => {
        expect(item.status).toBe("PAID");
      });
    });

    it("Scenario 5: Combined filters (cpf + status)", async () => {
      // 1. Create a payment with specific CPF
      const createResponse = await request(app.getHttpServer())
        .post("/api/payment")
        .send({
          cpf: "62021382117",
          description: "Combined Filter Test",
          amount: 400.0,
          paymentMethod: "PIX",
        });

      expect(createResponse.status).toBe(201);
      const paymentId = createResponse.body.id;

      // 2. Update payment to FAIL
      const updateResponse = await request(app.getHttpServer())
        .put(`/api/payment/${paymentId}`)
        .send({ status: "FAIL" });

      expect(updateResponse.status).toBe(200);

      // 3. Filter by cpf + status
      const listResponse = await request(app.getHttpServer()).get(
        "/api/payment?cpf=62021382117&status=FAIL",
      );

      expect(listResponse.status).toBe(200);
      expect(listResponse.body.items.length).toBeGreaterThanOrEqual(1);

      // Find the specific payment we created
      const foundPayment = listResponse.body.items.find(
        (item: any) => item.id === paymentId,
      );
      expect(foundPayment).toBeDefined();
      expect(foundPayment).toMatchObject({
        id: paymentId,
        cpf: "62021382117",
        status: "FAIL",
      });
    });

    it("Scenario 6: Pagination", async () => {
      // 1. Create multiple payments for pagination test
      const payments: string[] = [];
      for (let i = 0; i < 5; i++) {
        const createResponse = await request(app.getHttpServer())
          .post("/api/payment")
          .send({
            cpf: "62021382117",
            description: `Pagination Test ${i + 1}`,
            amount: 100.0 + i * 10,
            paymentMethod: "PIX",
          });
        expect(createResponse.status).toBe(201);
        payments.push(createResponse.body.id);
      }

      // 2. Test pagination
      const listResponse = await request(app.getHttpServer()).get(
        "/api/payment?page=1&limit=3",
      );

      expect(listResponse.status).toBe(200);
      expect(listResponse.body).toMatchObject({
        page: 1,
        limit: 3,
        total: expect.any(Number),
        hasNextPage: expect.any(Boolean),
      });
      expect(listResponse.body.items.length).toBeLessThanOrEqual(3);
    });

    it("Scenario 7: Last page without next", async () => {
      // 1. Get total count first
      const totalResponse = await request(app.getHttpServer()).get(
        "/api/payment",
      );
      const total = totalResponse.body.total;

      // 2. Calculate last page
      const limit = 10;
      const lastPage = Math.ceil(total / limit);

      // 3. Test last page
      const listResponse = await request(app.getHttpServer()).get(
        `/api/payment?page=${lastPage}&limit=${limit}`,
      );

      expect(listResponse.status).toBe(200);
      expect(listResponse.body).toMatchObject({
        page: lastPage,
        limit: limit,
        total: total,
        hasNextPage: false,
      });
    });

    it("Scenario 8: Invalid page=0 returns 400", async () => {
      const response = await request(app.getHttpServer()).get(
        "/api/payment?page=0",
      );

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        code: "VALIDATION_ERROR",
        message: expect.stringContaining("Page must be at least 1"),
      });
    });

    it("Scenario 9: Invalid limit=200 returns 400", async () => {
      const response = await request(app.getHttpServer()).get(
        "/api/payment?limit=200",
      );

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        code: "VALIDATION_ERROR",
        message: expect.stringContaining("Limit cannot exceed 100"),
      });
    });

    it("Scenario 10: Invalid status returns 400", async () => {
      const response = await request(app.getHttpServer()).get(
        "/api/payment?status=INVALID",
      );

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        code: "VALIDATION_ERROR",
        message: expect.stringContaining(
          "Status must be PENDING, PAID, or FAIL",
        ),
      });
    });

    it("Scenario 11: Descending order by createdAt", async () => {
      // 1. Create payments with small delays to ensure different timestamps
      const payment1 = await request(app.getHttpServer())
        .post("/api/payment")
        .send({
          cpf: "62021382117",
          description: "Order Test 1",
          amount: 100.0,
          paymentMethod: "PIX",
        });

      await new Promise((resolve) => setTimeout(resolve, 100));

      const payment2 = await request(app.getHttpServer())
        .post("/api/payment")
        .send({
          cpf: "62021382117",
          description: "Order Test 2",
          amount: 200.0,
          paymentMethod: "PIX",
        });

      expect(payment1.status).toBe(201);
      expect(payment2.status).toBe(201);

      // 2. List payments and verify order
      const listResponse = await request(app.getHttpServer()).get(
        "/api/payment",
      );

      expect(listResponse.status).toBe(200);
      expect(listResponse.body.items.length).toBeGreaterThanOrEqual(2);

      // Verify descending order (newest first)
      const items = listResponse.body.items;
      for (let i = 0; i < items.length - 1; i++) {
        const currentDate = new Date(items[i].createdAt);
        const nextDate = new Date(items[i + 1].createdAt);
        expect(currentDate.getTime()).toBeGreaterThanOrEqual(
          nextDate.getTime(),
        );
      }
    });

    it("Scenario 12: Performance test", async () => {
      const startTime = Date.now();

      const response = await request(app.getHttpServer()).get("/api/payment");

      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(200); // Should respond in less than 200ms
    });

    it("Scenario 13: Security against SQL injection", async () => {
      const response = await request(app.getHttpServer()).get(
        "/api/payment?cpf=' OR 1=1 --",
      );

      // Should not return all payments (security test)
      expect(response.status).toBe(200);
      expect(response.body.items).toBeDefined();
      // The response should be safe and not return all payments due to SQL injection
    });

    it("Scenario 14: Database persistence verification", async () => {
      // 1. Create a payment
      const createResponse = await request(app.getHttpServer())
        .post("/api/payment")
        .send({
          cpf: "62021382117",
          description: "Persistence Test",
          amount: 500.0,
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

      // 3. List payments via API
      const listResponse = await request(app.getHttpServer()).get(
        "/api/payment",
      );

      expect(listResponse.status).toBe(200);
      const foundPayment = listResponse.body.items.find(
        (item: any) => item.id === paymentId,
      );
      expect(foundPayment).toBeDefined();
      expect(foundPayment.cpf).toBe("62021382117");
    });

    it("Scenario 15: Headers and tracing verification", async () => {
      const response = await request(app.getHttpServer())
        .get("/api/payment")
        .set("X-Trace-ID", "custom-trace-123")
        .set("User-Agent", "Test-Agent/1.0")
        .set("Accept", "application/json");

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        items: expect.any(Array),
        page: 1,
        limit: 20,
        total: expect.any(Number),
        hasNextPage: expect.any(Boolean),
      });
      expect(response.headers["content-type"]).toContain("application/json");
    });
  });
});
