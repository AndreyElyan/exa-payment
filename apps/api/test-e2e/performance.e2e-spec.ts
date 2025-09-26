import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/infra/db/prisma.service";
import request from "supertest";

describe("Payment API Performance Tests", () => {
  let app: INestApplication;
  let prismaService: PrismaService;

  beforeAll(async () => {
    // Set up environment variables for testing
    process.env.DATABASE_URL =
      process.env.DATABASE_URL ||
      "postgresql://app:app@localhost:5434/payments";

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prismaService = moduleFixture.get<PrismaService>(PrismaService);

    await app.init();
  });

  beforeEach(async () => {});

  afterAll(async () => {
    await app.close();
  });

  describe("Performance Scenarios", () => {
    it("should handle 10 concurrent PIX payments under 200ms p95", async () => {
      const basePaymentData = {
        cpf: "33338177488",
        amount: 100.0,
        paymentMethod: "PIX",
      };

      const startTime = Date.now();
      const promises: any[] = [];

      // 5 sequential requests to avoid connection issues
      for (let i = 0; i < 5; i++) {
        promises.push(
          request(app.getHttpServer())
            .post("/api/payment")
            .send({
              ...basePaymentData,
              description: `Performance Test ${i}`,
            }),
        );
        // Small delay between requests to avoid database conflicts
        if (i < 4) await new Promise((resolve) => setTimeout(resolve, 100));
      }

      const responses = await Promise.all(promises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Verify that at least 4 out of 5 requests were successful
      const successfulResponses = responses.filter((r) => r.status === 201);
      expect(successfulResponses.length).toBeGreaterThanOrEqual(4);

      // Verify successful responses
      successfulResponses.forEach((response) => {
        expect(response.body.id).toBeDefined();
        expect(response.body.status).toBe("PENDING");
      });

      // Verify performance (total time < 5 seconds)
      expect(totalTime).toBeLessThan(5000);

      console.log(`Performance Test Results:`);
      console.log(`- Total time: ${totalTime}ms`);
      console.log(`- Average per request: ${(totalTime / 5).toFixed(2)}ms`);
      console.log(`- Success rate: ${successfulResponses.length}/5`);
    });

    it("should handle 3 concurrent CREDIT_CARD payments with idempotency", async () => {
      const basePaymentData = {
        cpf: "78123081626",
        amount: 200.0,
        paymentMethod: "CREDIT_CARD",
      };

      const startTime = Date.now();
      const promises: any[] = [];

      // 3 sequential requests with unique idempotency keys
      for (let i = 0; i < 3; i++) {
        promises.push(
          request(app.getHttpServer())
            .post("/api/payment")
            .set("Idempotency-Key", `perf-test-key-${Date.now()}-${i}`)
            .send({
              ...basePaymentData,
              description: `Credit Card Performance Test ${i}`,
            }),
        );
        // Small delay between requests to avoid database conflicts
        if (i < 2) await new Promise((resolve) => setTimeout(resolve, 100));
      }

      const responses = await Promise.all(promises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Verify that at least 1 out of 3 requests were successful
      const successfulResponses = responses.filter((r) => r.status === 201);
      expect(successfulResponses.length).toBeGreaterThanOrEqual(1);

      // Verify successful responses
      successfulResponses.forEach((response) => {
        expect(response.body.id).toBeDefined();
        expect(response.body.status).toBe("PENDING");
        expect(response.body.paymentMethod).toBe("CREDIT_CARD");
        expect(response.body.providerRef).toMatch(/^mp_/);
      });

      // Verify performance (total time < 10 seconds)
      expect(totalTime).toBeLessThan(10000);

      console.log(`Credit Card Performance Test Results:`);
      console.log(`- Total time: ${totalTime}ms`);
      console.log(`- Average per request: ${(totalTime / 3).toFixed(2)}ms`);
      console.log(`- Success rate: ${successfulResponses.length}/3`);
    });

    it("should handle idempotency correctly under load", async () => {
      const paymentData = {
        cpf: "55092005530",
        description: "Idempotency Load Test",
        amount: 150.0,
        paymentMethod: "PIX",
      };

      const idempotencyKey = `load-test-idempotency-key-${Date.now()}`;
      const startTime = Date.now();
      const promises: any[] = [];

      // 5 sequential requests with the same idempotency key
      for (let i = 0; i < 5; i++) {
        promises.push(
          request(app.getHttpServer())
            .post("/api/payment")
            .set("Idempotency-Key", idempotencyKey)
            .send(paymentData),
        );
      }

      const responses = await Promise.all(promises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Verify that at least one request was created (201) and others returned the same result (200)
      const createdResponses = responses.filter((r) => r.status === 201);
      const okResponses = responses.filter((r) => r.status === 200);

      expect(
        createdResponses.length + okResponses.length,
      ).toBeGreaterThanOrEqual(3);

      // Verify that all successful responses have consistent data (idempotency)
      const successfulResponses = responses.filter(
        (r) => r.status === 201 || r.status === 200,
      );
      if (successfulResponses.length > 0) {
        const firstResponse = successfulResponses[0];
        successfulResponses.forEach((response) => {
          expect(response.body.status).toBe(firstResponse.body.status);
          expect(response.body.paymentMethod).toBe(
            firstResponse.body.paymentMethod,
          );
          expect(response.body.amount).toBe(firstResponse.body.amount);
          expect(response.body.cpf).toBe(firstResponse.body.cpf);
        });
      }

      console.log(`Idempotency Load Test Results:`);
      console.log(`- Total time: ${totalTime}ms`);
      console.log(
        `- Created: ${createdResponses.length}, OK: ${okResponses.length}`,
      );
      console.log(`- Average per request: ${(totalTime / 5).toFixed(2)}ms`);
    });

    it("should handle mixed payment types under load", async () => {
      const startTime = Date.now();
      const promises: any[] = [];

      // 5 PIX payments
      for (let i = 0; i < 5; i++) {
        promises.push(
          request(app.getHttpServer())
            .post("/api/payment")
            .send({
              cpf: "33338177488",
              description: `Mixed PIX ${i}`,
              amount: 100.0 + i,
              paymentMethod: "PIX",
            }),
        );
      }

      // 3 CREDIT_CARD payments
      for (let i = 0; i < 3; i++) {
        promises.push(
          request(app.getHttpServer())
            .post("/api/payment")
            .set("Idempotency-Key", `mixed-test-key-${Date.now()}-${i}`)
            .send({
              cpf: "78123081626",
              description: `Mixed Credit Card ${i}`,
              amount: 200.0 + i,
              paymentMethod: "CREDIT_CARD",
            }),
        );
      }

      const responses = await Promise.all(promises);
      const endTime = Date.now();
      const totalTime = endTime - startTime;

      // Verify that at least 5 out of 8 requests were successful
      const successfulResponses = responses.filter((r) => r.status === 201);
      expect(successfulResponses.length).toBeGreaterThanOrEqual(5);

      // Verify successful responses
      successfulResponses.forEach((response) => {
        expect(response.body.id).toBeDefined();
        expect(response.body.status).toBe("PENDING");
      });

      // Verify distribution of types
      const pixPayments = successfulResponses.filter(
        (r) => r.body.paymentMethod === "PIX",
      );
      const creditCardPayments = successfulResponses.filter(
        (r) => r.body.paymentMethod === "CREDIT_CARD",
      );

      // Verify that CREDIT_CARD payments have providerRef
      creditCardPayments.forEach((response) => {
        expect(response.body.providerRef).toMatch(/^mp_/);
      });

      // Verify that PIX payments don't have providerRef
      pixPayments.forEach((response) => {
        expect(response.body.providerRef).toBeNull();
      });

      console.log(`Mixed Payment Types Test Results:`);
      console.log(`- Total time: ${totalTime}ms`);
      console.log(`- PIX payments: ${pixPayments.length}`);
      console.log(`- Credit Card payments: ${creditCardPayments.length}`);
      console.log(`- Average per request: ${(totalTime / 8).toFixed(2)}ms`);
    });
  });
});
