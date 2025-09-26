import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Test, TestingModule } from "@nestjs/testing";
import { PrismaService } from "../prisma.service";
import { PrismaPaymentRepository } from "../prisma-payment.repository";
import {
  Payment,
  PaymentMethod,
  PaymentStatus,
} from "../../../domain/entities/payment.entity";
import { MockPrismaService } from "./mocks/prisma.service.mock";

describe("PrismaPaymentRepository Integration Tests", () => {
  let repository: PrismaPaymentRepository;
  let prismaService: MockPrismaService;
  let module: TestingModule;

  beforeEach(async () => {
    module = await Test.createTestingModule({
      providers: [
        {
          provide: PrismaService,
          useClass: MockPrismaService,
        },
        PrismaPaymentRepository,
      ],
    }).compile();

    repository = module.get<PrismaPaymentRepository>(PrismaPaymentRepository);
    prismaService = module.get<PrismaService>(
      PrismaService,
    ) as MockPrismaService;

    // Clear mock data
    prismaService.clear();
  });

  afterEach(async () => {
    // Clean up mock data
    prismaService.clear();
    await module.close();
  });

  describe("save", () => {
    it("should save PIX payment successfully", async () => {
      const payment = Payment.create({
        cpf: "12345678909",
        description: "Teste PIX",
        amount: 100.0,
        paymentMethod: PaymentMethod.PIX,
      });

      const savedPayment = await repository.save(payment);

      expect(savedPayment.id).toBeDefined();
      expect(savedPayment.cpf).toBe("12345678909");
      expect(savedPayment.description).toBe("Teste PIX");
      expect(savedPayment.amount).toBe(100.0);
      expect(savedPayment.paymentMethod).toBe(PaymentMethod.PIX);
      expect(savedPayment.status).toBe(PaymentStatus.PENDING);
      expect(savedPayment.providerRef).toBeUndefined();
      expect(savedPayment.createdAt).toBeDefined();
      expect(savedPayment.updatedAt).toBeDefined();
    });

    it("should save CREDIT_CARD payment with providerRef", async () => {
      const payment = Payment.create({
        cpf: "98765432100",
        description: "Teste Cartão",
        amount: 200.0,
        paymentMethod: PaymentMethod.CREDIT_CARD,
      });

      payment.setProviderRef("mp_123456789");

      const savedPayment = await repository.save(payment);

      expect(savedPayment.id).toBeDefined();
      expect(savedPayment.paymentMethod).toBe(PaymentMethod.CREDIT_CARD);
      expect(savedPayment.providerRef).toBe("mp_123456789");
    });
  });

  describe("findById", () => {
    it("should find existing payment by id", async () => {
      const payment = Payment.create({
        cpf: "11122233344",
        description: "Teste Find",
        amount: 150.0,
        paymentMethod: PaymentMethod.PIX,
      });

      const savedPayment = await repository.save(payment);
      const foundPayment = await repository.findById(savedPayment.id);

      expect(foundPayment).toBeDefined();
      expect(foundPayment?.id).toBe(savedPayment.id);
      expect(foundPayment?.cpf).toBe("11122233344");
      expect(foundPayment?.description).toBe("Teste Find");
      expect(foundPayment?.amount).toBe(150.0);
    });

    it("should return null for non-existent payment", async () => {
      const foundPayment = await repository.findById("non-existent-id");
      expect(foundPayment).toBeNull();
    });
  });

  describe("update", () => {
    it("should update existing payment", async () => {
      const payment = Payment.create({
        cpf: "55566677788",
        description: "Teste Update",
        amount: 300.0,
        paymentMethod: PaymentMethod.CREDIT_CARD,
      });

      const savedPayment = await repository.save(payment);

      // Update providerRef
      savedPayment.setProviderRef("mp_updated_123");

      const updatedPayment = await repository.update(savedPayment);

      expect(updatedPayment.id).toBe(savedPayment.id);
      expect(updatedPayment.providerRef).toBe("mp_updated_123");
      expect(updatedPayment.updatedAt.getTime()).toBeGreaterThan(
        savedPayment.updatedAt.getTime(),
      );
    });
  });

  describe("database constraints", () => {
    it("should enforce unique providerRef constraint", async () => {
      const payment1 = Payment.create({
        cpf: "11111111111",
        description: "Payment 1",
        amount: 100.0,
        paymentMethod: PaymentMethod.CREDIT_CARD,
      });

      const payment2 = Payment.create({
        cpf: "22222222222",
        description: "Payment 2",
        amount: 200.0,
        paymentMethod: PaymentMethod.CREDIT_CARD,
      });

      payment1.setProviderRef("mp_same_ref");
      payment2.setProviderRef("mp_same_ref");

      await repository.save(payment1);

      // Second payment with same providerRef should fail
      await expect(repository.save(payment2)).rejects.toThrow();
    });

    it("should handle concurrent saves correctly", async () => {
      const payments = Array.from({ length: 10 }, (_, i) =>
        Payment.create({
          cpf: `1234567890${i}`,
          description: `Concurrent Test ${i}`,
          amount: 100.0 + i,
          paymentMethod: PaymentMethod.PIX,
        }),
      );

      // Save all payments concurrently
      const savedPayments = await Promise.all(
        payments.map((payment) => repository.save(payment)),
      );

      expect(savedPayments).toHaveLength(10);
      savedPayments.forEach((payment, index) => {
        expect(payment.id).toBeDefined();
        expect(payment.cpf).toBe(`1234567890${index}`);
        expect(payment.amount).toBe(100.0 + index);
      });
    });
  });
});
