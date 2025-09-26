import { Test, TestingModule } from "@nestjs/testing";
import { PaymentController } from "../payment.controller";
import { PaymentRepository } from "../../../application/ports/payment.repository.port";
import {
  Payment,
  PaymentStatus,
  PaymentMethod,
} from "../../../domain/entities/payment.entity";
import { NotFoundException } from "@nestjs/common";
import { CreatePaymentUseCase } from "../../../application/use-cases/create-payment.use-case";
import { UpdatePaymentUseCase } from "../../../application/use-cases/update-payment.use-case";
import { vi } from "vitest";

describe("PaymentController - getPaymentById", () => {
  let controller: PaymentController;
  let paymentRepository: PaymentRepository;

  const mockPaymentRepository = {
    findById: vi.fn(),
  };

  const mockCreatePaymentUseCase = {
    execute: vi.fn(),
  };

  const mockUpdatePaymentUseCase = {
    execute: vi.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PaymentController],
      providers: [
        {
          provide: "PaymentRepository",
          useValue: mockPaymentRepository,
        },
        {
          provide: CreatePaymentUseCase,
          useValue: mockCreatePaymentUseCase,
        },
        {
          provide: UpdatePaymentUseCase,
          useValue: mockUpdatePaymentUseCase,
        },
      ],
    }).compile();

    controller = module.get<PaymentController>(PaymentController);
    paymentRepository = module.get<PaymentRepository>("PaymentRepository");
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getPaymentById", () => {
    it("should return payment when found", async () => {
      const paymentId = "823172ea-5628-4ee4-adc9-47396b0dfdca";
      const mockPayment = Payment.restore({
        id: paymentId,
        cpf: "12345678909",
        description: "Mensalidade",
        amount: 199.9,
        paymentMethod: PaymentMethod.PIX,
        status: PaymentStatus.PENDING,
        providerRef: undefined,
        createdAt: new Date("2025-01-26T12:34:56.000Z"),
        updatedAt: new Date("2025-01-26T12:34:56.000Z"),
      });

      mockPaymentRepository.findById.mockResolvedValue(mockPayment);

      const result = await controller.getPaymentById(paymentId);

      expect(result).toBeDefined();
      expect(result.id).toBe(paymentId);
      expect(result.cpf).toBe("12345678909");
      expect(result.paymentMethod).toBe("PIX");
      expect(result.status).toBe("PENDING");
      expect(result.providerRef).toBeNull();
      expect(mockPaymentRepository.findById).toHaveBeenCalledWith(paymentId);
    });

    it("should return payment with CREDIT_CARD method and providerRef", async () => {
      const paymentId = "823172ea-5628-4ee4-adc9-47396b0dfdca";
      const mockPayment = Payment.restore({
        id: paymentId,
        cpf: "12345678909",
        description: "Mensalidade",
        amount: 199.9,
        paymentMethod: PaymentMethod.CREDIT_CARD,
        status: PaymentStatus.PENDING,
        providerRef: "mp_123456789",
        createdAt: new Date("2025-01-26T12:34:56.000Z"),
        updatedAt: new Date("2025-01-26T12:34:56.000Z"),
      });

      mockPaymentRepository.findById.mockResolvedValue(mockPayment);

      const result = await controller.getPaymentById(paymentId);

      expect(result).toBeDefined();
      expect(result.id).toBe(paymentId);
      expect(result.paymentMethod).toBe("CREDIT_CARD");
      expect(result.providerRef).toBe("mp_123456789");
      expect(result.status).toBe("PENDING");
    });

    it("should return payment with PAID status", async () => {
      const paymentId = "823172ea-5628-4ee4-adc9-47396b0dfdca";
      const mockPayment = Payment.restore({
        id: paymentId,
        cpf: "12345678909",
        description: "Mensalidade",
        amount: 199.9,
        paymentMethod: PaymentMethod.PIX,
        status: PaymentStatus.PAID,
        providerRef: undefined,
        createdAt: new Date("2025-01-26T12:34:56.000Z"),
        updatedAt: new Date("2025-01-26T12:34:56.000Z"),
      });

      mockPaymentRepository.findById.mockResolvedValue(mockPayment);

      const result = await controller.getPaymentById(paymentId);

      expect(result).toBeDefined();
      expect(result.status).toBe("PAID");
    });

    it("should throw NotFoundException when payment not found", async () => {
      const paymentId = "823172ea-5628-4ee4-adc9-47396b0dfdca";

      mockPaymentRepository.findById.mockResolvedValue(null);

      await expect(controller.getPaymentById(paymentId)).rejects.toThrow(
        NotFoundException,
      );
      expect(mockPaymentRepository.findById).toHaveBeenCalledWith(paymentId);
    });

    it("should handle repository errors", async () => {
      const paymentId = "823172ea-5628-4ee4-adc9-47396b0dfdca";
      const error = new Error("Database connection failed");

      mockPaymentRepository.findById.mockRejectedValue(error);

      await expect(controller.getPaymentById(paymentId)).rejects.toThrow(
        "Database connection failed",
      );
    });
  });
});
