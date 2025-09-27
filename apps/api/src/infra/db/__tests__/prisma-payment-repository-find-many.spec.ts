import { Test, TestingModule } from "@nestjs/testing";
import { PrismaService } from "../prisma.service";
import { PrismaPaymentRepository } from "../prisma-payment.repository";
import {
  Payment,
  PaymentStatus,
  PaymentMethod,
} from "../../../domain/entities/payment.entity";
import { vi } from "vitest";

describe("PrismaPaymentRepository - findMany", () => {
  let repository: PrismaPaymentRepository;
  let prismaService: PrismaService;

  const mockPrismaService = {
    payment: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PrismaPaymentRepository,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    repository = module.get<PrismaPaymentRepository>(PrismaPaymentRepository);
    prismaService = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("findMany", () => {
    it("should return payments with no filters", async () => {
      const mockPayments = [
        {
          id: "payment-1",
          cpf: "12345678900",
          description: "Test Payment 1",
          amount: 100.0,
          paymentMethod: "PIX",
          status: "PENDING",
          providerRef: null,
          createdAt: new Date("2023-01-01"),
          updatedAt: new Date("2023-01-01"),
        },
        {
          id: "payment-2",
          cpf: "12345678901",
          description: "Test Payment 2",
          amount: 200.0,
          paymentMethod: "CREDIT_CARD",
          status: "PAID",
          providerRef: "mp_123",
          createdAt: new Date("2023-01-02"),
          updatedAt: new Date("2023-01-02"),
        },
      ];

      mockPrismaService.payment.findMany.mockResolvedValue(mockPayments);
      mockPrismaService.payment.count.mockResolvedValue(2);

      const result = await repository.findMany({}, 1, 20);

      expect(result.items).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(result.items[0]).toBeInstanceOf(Payment);
      expect(result.items[1]).toBeInstanceOf(Payment);
      expect(mockPrismaService.payment.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 20,
        orderBy: { createdAt: "desc" },
      });
      expect(mockPrismaService.payment.count).toHaveBeenCalledWith({
        where: {},
      });
    });

    it("should return payments with CPF filter", async () => {
      const mockPayments = [
        {
          id: "payment-1",
          cpf: "12345678900",
          description: "Test Payment",
          amount: 100.0,
          paymentMethod: "PIX",
          status: "PENDING",
          providerRef: null,
          createdAt: new Date("2023-01-01"),
          updatedAt: new Date("2023-01-01"),
        },
      ];

      mockPrismaService.payment.findMany.mockResolvedValue(mockPayments);
      mockPrismaService.payment.count.mockResolvedValue(1);

      const result = await repository.findMany({ cpf: "12345678900" }, 1, 20);

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(mockPrismaService.payment.findMany).toHaveBeenCalledWith({
        where: { cpf: "12345678900" },
        skip: 0,
        take: 20,
        orderBy: { createdAt: "desc" },
      });
      expect(mockPrismaService.payment.count).toHaveBeenCalledWith({
        where: { cpf: "12345678900" },
      });
    });

    it("should return payments with paymentMethod filter", async () => {
      const mockPayments = [
        {
          id: "payment-1",
          cpf: "12345678900",
          description: "Test Payment",
          amount: 100.0,
          paymentMethod: "PIX",
          status: "PENDING",
          providerRef: null,
          createdAt: new Date("2023-01-01"),
          updatedAt: new Date("2023-01-01"),
        },
      ];

      mockPrismaService.payment.findMany.mockResolvedValue(mockPayments);
      mockPrismaService.payment.count.mockResolvedValue(1);

      const result = await repository.findMany({ paymentMethod: "PIX" }, 1, 20);

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(mockPrismaService.payment.findMany).toHaveBeenCalledWith({
        where: { paymentMethod: "PIX" },
        skip: 0,
        take: 20,
        orderBy: { createdAt: "desc" },
      });
    });

    it("should return payments with status filter", async () => {
      const mockPayments = [
        {
          id: "payment-1",
          cpf: "12345678900",
          description: "Test Payment",
          amount: 100.0,
          paymentMethod: "PIX",
          status: "PAID",
          providerRef: null,
          createdAt: new Date("2023-01-01"),
          updatedAt: new Date("2023-01-01"),
        },
      ];

      mockPrismaService.payment.findMany.mockResolvedValue(mockPayments);
      mockPrismaService.payment.count.mockResolvedValue(1);

      const result = await repository.findMany({ status: "PAID" }, 1, 20);

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(mockPrismaService.payment.findMany).toHaveBeenCalledWith({
        where: { status: "PAID" },
        skip: 0,
        take: 20,
        orderBy: { createdAt: "desc" },
      });
    });

    it("should return payments with combined filters", async () => {
      const mockPayments = [
        {
          id: "payment-1",
          cpf: "12345678900",
          description: "Test Payment",
          amount: 100.0,
          paymentMethod: "PIX",
          status: "PAID",
          providerRef: null,
          createdAt: new Date("2023-01-01"),
          updatedAt: new Date("2023-01-01"),
        },
      ];

      mockPrismaService.payment.findMany.mockResolvedValue(mockPayments);
      mockPrismaService.payment.count.mockResolvedValue(1);

      const result = await repository.findMany(
        { cpf: "12345678900", paymentMethod: "PIX", status: "PAID" },
        1,
        20,
      );

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(mockPrismaService.payment.findMany).toHaveBeenCalledWith({
        where: {
          cpf: "12345678900",
          paymentMethod: "PIX",
          status: "PAID",
        },
        skip: 0,
        take: 20,
        orderBy: { createdAt: "desc" },
      });
    });

    it("should handle pagination correctly", async () => {
      const mockPayments = [
        {
          id: "payment-1",
          cpf: "12345678900",
          description: "Test Payment",
          amount: 100.0,
          paymentMethod: "PIX",
          status: "PENDING",
          providerRef: null,
          createdAt: new Date("2023-01-01"),
          updatedAt: new Date("2023-01-01"),
        },
      ];

      mockPrismaService.payment.findMany.mockResolvedValue(mockPayments);
      mockPrismaService.payment.count.mockResolvedValue(25);

      const result = await repository.findMany({}, 2, 10);

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(25);
      expect(mockPrismaService.payment.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 10, // (page - 1) * limit = (2 - 1) * 10 = 10
        take: 10,
        orderBy: { createdAt: "desc" },
      });
    });

    it("should return empty result when no payments found", async () => {
      mockPrismaService.payment.findMany.mockResolvedValue([]);
      mockPrismaService.payment.count.mockResolvedValue(0);

      const result = await repository.findMany({ cpf: "nonexistent" }, 1, 20);

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(mockPrismaService.payment.findMany).toHaveBeenCalledWith({
        where: { cpf: "nonexistent" },
        skip: 0,
        take: 20,
        orderBy: { createdAt: "desc" },
      });
    });

    it("should handle database errors", async () => {
      mockPrismaService.payment.findMany.mockRejectedValue(
        new Error("Database error"),
      );

      await expect(repository.findMany({}, 1, 20)).rejects.toThrow(
        "Database error",
      );
    });

    it("should map payment data correctly to Payment entities", async () => {
      const mockPayments = [
        {
          id: "payment-1",
          cpf: "12345678900",
          description: "Test Payment",
          amount: 100.0,
          paymentMethod: "PIX",
          status: "PENDING",
          providerRef: null,
          createdAt: new Date("2023-01-01"),
          updatedAt: new Date("2023-01-01"),
        },
        {
          id: "payment-2",
          cpf: "12345678901",
          description: "Credit Card Payment",
          amount: 200.0,
          paymentMethod: "CREDIT_CARD",
          status: "PAID",
          providerRef: "mp_123",
          createdAt: new Date("2023-01-02"),
          updatedAt: new Date("2023-01-02"),
        },
      ];

      mockPrismaService.payment.findMany.mockResolvedValue(mockPayments);
      mockPrismaService.payment.count.mockResolvedValue(2);

      const result = await repository.findMany({}, 1, 20);

      expect(result.items).toHaveLength(2);
      expect(result.items[0]).toBeInstanceOf(Payment);
      expect(result.items[0].id).toBe("payment-1");
      expect(result.items[0].cpf).toBe("12345678900");
      expect(result.items[0].paymentMethod).toBe(PaymentMethod.PIX);
      expect(result.items[0].status).toBe(PaymentStatus.PENDING);
      expect(result.items[0].providerRef).toBeUndefined();

      expect(result.items[1]).toBeInstanceOf(Payment);
      expect(result.items[1].id).toBe("payment-2");
      expect(result.items[1].cpf).toBe("12345678901");
      expect(result.items[1].paymentMethod).toBe(PaymentMethod.CREDIT_CARD);
      expect(result.items[1].status).toBe(PaymentStatus.PAID);
      expect(result.items[1].providerRef).toBe("mp_123");
    });
  });
});
