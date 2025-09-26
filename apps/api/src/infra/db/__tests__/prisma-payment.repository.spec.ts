import { Test, TestingModule } from "@nestjs/testing";
import { PrismaService } from "../prisma.service";
import { PrismaPaymentRepository } from "../prisma-payment.repository";
import {
  Payment,
  PaymentStatus,
  PaymentMethod,
} from "../../../domain/entities/payment.entity";
import { vi } from "vitest";

describe("PrismaPaymentRepository - findById", () => {
  let repository: PrismaPaymentRepository;
  let prismaService: PrismaService;

  const mockPrismaService = {
    payment: {
      findUnique: vi.fn(),
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

  describe("findById", () => {
    it("should return payment when found", async () => {
      const paymentId = "823172ea-5628-4ee4-adc9-47396b0dfdca";
      const mockPaymentData = {
        id: paymentId,
        cpf: "12345678909",
        description: "Mensalidade",
        amount: 199.9,
        paymentMethod: "PIX",
        status: "PENDING",
        providerRef: null,
        createdAt: new Date("2025-01-26T12:34:56.000Z"),
        updatedAt: new Date("2025-01-26T12:34:56.000Z"),
      };

      mockPrismaService.payment.findUnique.mockResolvedValue(mockPaymentData);

      const result = await repository.findById(paymentId);

      expect(result).toBeInstanceOf(Payment);
      expect(result.id).toBe(paymentId);
      expect(result.cpf).toBe("12345678909");
      expect(result.paymentMethod).toBe(PaymentMethod.PIX);
      expect(result.status).toBe(PaymentStatus.PENDING);
      expect(result.providerRef).toBeUndefined();
      expect(mockPrismaService.payment.findUnique).toHaveBeenCalledWith({
        where: { id: paymentId },
      });
    });

    it("should return null when payment not found", async () => {
      const paymentId = "823172ea-5628-4ee4-adc9-47396b0dfdca";

      mockPrismaService.payment.findUnique.mockResolvedValue(null);

      const result = await repository.findById(paymentId);

      expect(result).toBeNull();
      expect(mockPrismaService.payment.findUnique).toHaveBeenCalledWith({
        where: { id: paymentId },
      });
    });

    it("should handle database errors", async () => {
      const paymentId = "823172ea-5628-4ee4-adc9-47396b0dfdca";
      const error = new Error("Database connection failed");

      mockPrismaService.payment.findUnique.mockRejectedValue(error);

      await expect(repository.findById(paymentId)).rejects.toThrow(
        "Database connection failed",
      );
    });

    it("should return payment with CREDIT_CARD method and providerRef", async () => {
      const paymentId = "823172ea-5628-4ee4-adc9-47396b0dfdca";
      const mockPaymentData = {
        id: paymentId,
        cpf: "12345678909",
        description: "Mensalidade",
        amount: 199.9,
        paymentMethod: "CREDIT_CARD",
        status: "PENDING",
        providerRef: "mp_123456789",
        createdAt: new Date("2025-01-26T12:34:56.000Z"),
        updatedAt: new Date("2025-01-26T12:34:56.000Z"),
      };

      mockPrismaService.payment.findUnique.mockResolvedValue(mockPaymentData);

      const result = await repository.findById(paymentId);

      expect(result).toBeInstanceOf(Payment);
      expect(result.id).toBe(paymentId);
      expect(result.paymentMethod).toBe(PaymentMethod.CREDIT_CARD);
      expect(result.providerRef).toBe("mp_123456789");
      expect(result.status).toBe(PaymentStatus.PENDING);
    });

    it("should return payment with PAID status", async () => {
      const paymentId = "823172ea-5628-4ee4-adc9-47396b0dfdca";
      const mockPaymentData = {
        id: paymentId,
        cpf: "12345678909",
        description: "Mensalidade",
        amount: 199.9,
        paymentMethod: "PIX",
        status: "PAID",
        providerRef: null,
        createdAt: new Date("2025-01-26T12:34:56.000Z"),
        updatedAt: new Date("2025-01-26T12:34:56.000Z"),
      };

      mockPrismaService.payment.findUnique.mockResolvedValue(mockPaymentData);

      const result = await repository.findById(paymentId);

      expect(result).toBeInstanceOf(Payment);
      expect(result.status).toBe(PaymentStatus.PAID);
    });
  });
});
