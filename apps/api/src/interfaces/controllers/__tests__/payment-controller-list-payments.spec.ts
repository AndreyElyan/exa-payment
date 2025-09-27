import { Test, TestingModule } from "@nestjs/testing";
import { PaymentController } from "../payment.controller";
import { PaymentRepository } from "../../../application/ports/payment.repository.port";
import {
  Payment,
  PaymentStatus,
  PaymentMethod,
} from "../../../domain/entities/payment.entity";
import { CreatePaymentUseCase } from "../../../application/use-cases/create-payment.use-case";
import { UpdatePaymentUseCase } from "../../../application/use-cases/update-payment.use-case";
import { vi } from "vitest";

describe("PaymentController - listPayments", () => {
  let controller: PaymentController;
  let paymentRepository: PaymentRepository;
  let createPaymentUseCase: CreatePaymentUseCase;
  let updatePaymentUseCase: UpdatePaymentUseCase;

  const mockPaymentRepository = {
    findMany: vi.fn(),
    findById: vi.fn(),
    save: vi.fn(),
    update: vi.fn(),
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
    createPaymentUseCase =
      module.get<CreatePaymentUseCase>(CreatePaymentUseCase);
    updatePaymentUseCase =
      module.get<UpdatePaymentUseCase>(UpdatePaymentUseCase);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("listPayments", () => {
    it("should return payments with default pagination", async () => {
      const mockPayments = [
        Payment.create({
          cpf: "12345678900",
          description: "Test Payment 1",
          amount: 100.0,
          paymentMethod: PaymentMethod.PIX,
        }),
        Payment.create({
          cpf: "12345678901",
          description: "Test Payment 2",
          amount: 200.0,
          paymentMethod: PaymentMethod.CREDIT_CARD,
        }),
      ];

      mockPaymentRepository.findMany.mockResolvedValue({
        items: mockPayments,
        total: 2,
      });

      const query = { page: 1, limit: 20 };
      const result = await controller.listPayments(query);

      expect(result.items).toHaveLength(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.total).toBe(2);
      expect(result.hasNextPage).toBe(false);
      expect(mockPaymentRepository.findMany).toHaveBeenCalledWith({}, 1, 20);
    });

    it("should return payments with CPF filter", async () => {
      const mockPayments = [
        Payment.create({
          cpf: "12345678900",
          description: "Test Payment",
          amount: 100.0,
          paymentMethod: PaymentMethod.PIX,
        }),
      ];

      mockPaymentRepository.findMany.mockResolvedValue({
        items: mockPayments,
        total: 1,
      });

      const query = { cpf: "12345678900", page: 1, limit: 20 };
      const result = await controller.listPayments(query);

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(mockPaymentRepository.findMany).toHaveBeenCalledWith(
        { cpf: "12345678900" },
        1,
        20,
      );
    });

    it("should return payments with paymentMethod filter", async () => {
      const mockPayments = [
        Payment.create({
          cpf: "12345678900",
          description: "Test Payment",
          amount: 100.0,
          paymentMethod: PaymentMethod.PIX,
        }),
      ];

      mockPaymentRepository.findMany.mockResolvedValue({
        items: mockPayments,
        total: 1,
      });

      const query = { paymentMethod: PaymentMethod.PIX, page: 1, limit: 20 };
      const result = await controller.listPayments(query);

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(mockPaymentRepository.findMany).toHaveBeenCalledWith(
        { paymentMethod: PaymentMethod.PIX },
        1,
        20,
      );
    });

    it("should return payments with status filter", async () => {
      const mockPayments = [
        Payment.create({
          cpf: "12345678900",
          description: "Test Payment",
          amount: 100.0,
          paymentMethod: PaymentMethod.PIX,
        }),
      ];
      mockPayments[0].transitionTo(PaymentStatus.PAID);

      mockPaymentRepository.findMany.mockResolvedValue({
        items: mockPayments,
        total: 1,
      });

      const query = { status: PaymentStatus.PAID, page: 1, limit: 20 };
      const result = await controller.listPayments(query);

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(mockPaymentRepository.findMany).toHaveBeenCalledWith(
        { status: PaymentStatus.PAID },
        1,
        20,
      );
    });

    it("should return payments with combined filters", async () => {
      const mockPayments = [
        Payment.create({
          cpf: "12345678900",
          description: "Test Payment",
          amount: 100.0,
          paymentMethod: PaymentMethod.PIX,
        }),
      ];
      mockPayments[0].transitionTo(PaymentStatus.PAID);

      mockPaymentRepository.findMany.mockResolvedValue({
        items: mockPayments,
        total: 1,
      });

      const query = {
        cpf: "12345678900",
        paymentMethod: PaymentMethod.PIX,
        status: PaymentStatus.PAID,
        page: 1,
        limit: 20,
      };
      const result = await controller.listPayments(query);

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(mockPaymentRepository.findMany).toHaveBeenCalledWith(
        {
          cpf: "12345678900",
          paymentMethod: PaymentMethod.PIX,
          status: PaymentStatus.PAID,
        },
        1,
        20,
      );
    });

    it("should handle pagination correctly", async () => {
      const mockPayments = [
        Payment.create({
          cpf: "12345678900",
          description: "Test Payment",
          amount: 100.0,
          paymentMethod: PaymentMethod.PIX,
        }),
      ];

      mockPaymentRepository.findMany.mockResolvedValue({
        items: mockPayments,
        total: 25,
      });

      const query = { page: 2, limit: 10 };
      const result = await controller.listPayments(query);

      expect(result.items).toHaveLength(1);
      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
      expect(result.total).toBe(25);
      expect(result.hasNextPage).toBe(true);
      expect(mockPaymentRepository.findMany).toHaveBeenCalledWith({}, 2, 10);
    });

    it("should return empty result when no payments found", async () => {
      mockPaymentRepository.findMany.mockResolvedValue({
        items: [],
        total: 0,
      });

      const query = { cpf: "nonexistent", page: 1, limit: 20 };
      const result = await controller.listPayments(query);

      expect(result.items).toHaveLength(0);
      expect(result.total).toBe(0);
      expect(result.hasNextPage).toBe(false);
      expect(mockPaymentRepository.findMany).toHaveBeenCalledWith(
        { cpf: "nonexistent" },
        1,
        20,
      );
    });

    it("should handle repository errors", async () => {
      mockPaymentRepository.findMany.mockRejectedValue(
        new Error("Database error"),
      );

      const query = { page: 1, limit: 20 };
      await expect(controller.listPayments(query)).rejects.toThrow(
        "Database error",
      );
    });

    it("should use default values when page and limit are not provided", async () => {
      const mockPayments = [
        Payment.create({
          cpf: "12345678900",
          description: "Test Payment",
          amount: 100.0,
          paymentMethod: PaymentMethod.PIX,
        }),
      ];

      mockPaymentRepository.findMany.mockResolvedValue({
        items: mockPayments,
        total: 1,
      });

      const query = {};
      const result = await controller.listPayments(query);

      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(mockPaymentRepository.findMany).toHaveBeenCalledWith({}, 1, 20);
    });

    it("should map Payment entities to PaymentResponseDto correctly", async () => {
      const mockPayments = [
        Payment.create({
          cpf: "12345678900",
          description: "Test Payment",
          amount: 100.0,
          paymentMethod: PaymentMethod.PIX,
        }),
        Payment.create({
          cpf: "12345678901",
          description: "Credit Card Payment",
          amount: 200.0,
          paymentMethod: PaymentMethod.CREDIT_CARD,
        }),
      ];
      mockPayments[1].setProviderRef("mp_123");

      mockPaymentRepository.findMany.mockResolvedValue({
        items: mockPayments,
        total: 2,
      });

      const query = { page: 1, limit: 20 };
      const result = await controller.listPayments(query);

      expect(result.items).toHaveLength(2);
      expect(result.items[0]).toMatchObject({
        cpf: "12345678900",
        description: "Test Payment",
        amount: 100.0,
        paymentMethod: PaymentMethod.PIX,
        status: PaymentStatus.PENDING,
        providerRef: null,
      });
      expect(result.items[1]).toMatchObject({
        cpf: "12345678901",
        description: "Credit Card Payment",
        amount: 200.0,
        paymentMethod: PaymentMethod.CREDIT_CARD,
        status: PaymentStatus.PENDING,
        providerRef: "mp_123",
      });
    });

    it("should calculate hasNextPage correctly", async () => {
      const mockPayments = [
        Payment.create({
          cpf: "12345678900",
          description: "Test Payment",
          amount: 100.0,
          paymentMethod: PaymentMethod.PIX,
        }),
      ];

      // Test case: hasNextPage = true
      mockPaymentRepository.findMany.mockResolvedValue({
        items: mockPayments,
        total: 25,
      });

      const query1 = { page: 1, limit: 10 };
      const result1 = await controller.listPayments(query1);

      expect(result1.hasNextPage).toBe(true); // 1 * 10 < 25

      // Test case: hasNextPage = false
      mockPaymentRepository.findMany.mockResolvedValue({
        items: mockPayments,
        total: 10,
      });

      const query2 = { page: 1, limit: 10 };
      const result2 = await controller.listPayments(query2);

      expect(result2.hasNextPage).toBe(false); // 1 * 10 = 10
    });
  });
});
