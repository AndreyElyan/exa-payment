import { describe, it, expect, beforeEach, vi } from "vitest";
import { CreatePaymentUseCase } from "../create-payment.use-case";
import {
  Payment,
  PaymentMethod,
  PaymentStatus,
} from "../../../domain/entities/payment.entity";
import { IdempotencyService } from "../../../domain/services/idempotency.service";
import { CreatePaymentDto } from "../../../interfaces/dto/create-payment.dto";
import { TemporalClientService } from "../../../infra/workflows/temporal-client";

describe("CreatePaymentUseCase", () => {
  let useCase: CreatePaymentUseCase;
  let mockPaymentRepository: any;
  let mockPaymentProvider: any;
  let mockIdempotencyService: IdempotencyService;
  let mockTemporalClient: any;

  beforeEach(() => {
    mockPaymentRepository = {
      save: vi.fn(),
      findById: vi.fn(),
      update: vi.fn(),
    };

    mockPaymentProvider = {
      createCreditCardCharge: vi.fn(),
    };

    mockTemporalClient = {
      startCreditCardPaymentWorkflow: vi.fn(),
      signalPaymentStatus: vi.fn(),
      getPaymentStatus: vi.fn(),
      getWorkflowResult: vi.fn(),
    };

    mockIdempotencyService = new IdempotencyService();

    useCase = new CreatePaymentUseCase(
      mockPaymentRepository,
      mockPaymentProvider,
      mockIdempotencyService,
      mockTemporalClient,
    );
  });

  describe("PIX payment scenarios", () => {
    it("should create PIX payment successfully (Cenário 1)", async () => {
      const dto: CreatePaymentDto = {
        cpf: "12345678909",
        description: "Mensalidade",
        amount: 199.9,
        paymentMethod: PaymentMethod.PIX,
      };

      const mockPayment = Payment.create({
        cpf: dto.cpf,
        description: dto.description,
        amount: dto.amount,
        paymentMethod: dto.paymentMethod,
      });

      mockPaymentRepository.save.mockResolvedValue(mockPayment);

      const result = await useCase.execute({ dto });

      expect(result.isNew).toBe(true);
      expect(result.payment.paymentMethod).toBe(PaymentMethod.PIX);
      expect(result.payment.status).toBe(PaymentStatus.PENDING);
      expect(result.payment.providerRef).toBeUndefined();
      expect(mockPaymentRepository.save).toHaveBeenCalledTimes(1);
      expect(mockPaymentProvider.createCreditCardCharge).not.toHaveBeenCalled();
    });

    it("should not call provider for PIX payments", async () => {
      const dto: CreatePaymentDto = {
        cpf: "12345678909",
        description: "Mensalidade",
        amount: 199.9,
        paymentMethod: PaymentMethod.PIX,
      };

      const mockPayment = Payment.create({
        cpf: dto.cpf,
        description: dto.description,
        amount: dto.amount,
        paymentMethod: dto.paymentMethod,
      });

      mockPaymentRepository.save.mockResolvedValue(mockPayment);

      await useCase.execute({ dto });

      expect(mockPaymentProvider.createCreditCardCharge).not.toHaveBeenCalled();
    });
  });

  describe("CREDIT_CARD payment scenarios", () => {
    it("should create CREDIT_CARD payment successfully with Temporal (Cenário 2)", async () => {
      const dto: CreatePaymentDto = {
        cpf: "12345678909",
        description: "Mensalidade",
        amount: 199.9,
        paymentMethod: PaymentMethod.CREDIT_CARD,
      };

      const idempotencyKey = "test-key-123";
      const mockPayment = Payment.create({
        cpf: dto.cpf,
        description: dto.description,
        amount: dto.amount,
        paymentMethod: dto.paymentMethod,
      });

      mockTemporalClient.startCreditCardPaymentWorkflow.mockResolvedValue({
        workflowId: "credit-card-payment-pay_123",
        runId: "run_456",
      });

      mockPaymentRepository.save.mockResolvedValue(mockPayment);

      const result = await useCase.execute({ dto, idempotencyKey });

      expect(result.isNew).toBe(true);
      expect(result.payment.paymentMethod).toBe(PaymentMethod.CREDIT_CARD);
      expect(result.payment.status).toBe(PaymentStatus.PENDING);
      expect(
        mockTemporalClient.startCreditCardPaymentWorkflow,
      ).toHaveBeenCalledWith({
        paymentId: expect.any(String),
        cpf: dto.cpf,
        description: dto.description,
        amount: dto.amount,
        idempotencyKey,
      });
      expect(mockPaymentProvider.createCreditCardCharge).not.toHaveBeenCalled();
      expect(mockPaymentRepository.save).toHaveBeenCalledTimes(1);
    });

    it("should fallback to provider when Temporal fails", async () => {
      const dto: CreatePaymentDto = {
        cpf: "12345678909",
        description: "Mensalidade",
        amount: 199.9,
        paymentMethod: PaymentMethod.CREDIT_CARD,
      };

      const idempotencyKey = "test-key-123";
      const mockPayment = Payment.create({
        cpf: dto.cpf,
        description: dto.description,
        amount: dto.amount,
        paymentMethod: dto.paymentMethod,
      });

      const providerRef = "mp_123456789";

      // Mock Temporal failure
      mockTemporalClient.startCreditCardPaymentWorkflow.mockRejectedValue(
        new Error("Temporal service unavailable"),
      );

      // Mock successful provider fallback
      mockPaymentProvider.createCreditCardCharge.mockResolvedValue({
        providerRef,
      });

      mockPaymentRepository.save.mockResolvedValue(mockPayment);

      const result = await useCase.execute({ dto, idempotencyKey });

      expect(result.isNew).toBe(true);
      expect(result.payment.paymentMethod).toBe(PaymentMethod.CREDIT_CARD);
      expect(result.payment.status).toBe(PaymentStatus.PENDING);
      expect(
        mockTemporalClient.startCreditCardPaymentWorkflow,
      ).toHaveBeenCalled();
      expect(mockPaymentProvider.createCreditCardCharge).toHaveBeenCalledWith({
        amount: dto.amount,
        description: dto.description,
        idempotencyKey,
        cpf: dto.cpf,
      });
      expect(mockPaymentRepository.save).toHaveBeenCalledTimes(1);
    });

    it("should require idempotency key for CREDIT_CARD (Cenário 9)", async () => {
      const dto: CreatePaymentDto = {
        cpf: "12345678909",
        description: "Mensalidade",
        amount: 199.9,
        paymentMethod: PaymentMethod.CREDIT_CARD,
      };

      await expect(useCase.execute({ dto })).rejects.toThrow(
        "Idempotency-Key é obrigatório para CREDIT_CARD",
      );
    });
  });

  describe("Idempotency scenarios", () => {
    it("should handle idempotency for same key and body (Cenário 3)", async () => {
      const dto: CreatePaymentDto = {
        cpf: "12345678909",
        description: "Mensalidade",
        amount: 199.9,
        paymentMethod: PaymentMethod.PIX,
      };

      const idempotencyKey = "test-key-123";
      const mockPayment = Payment.create({
        cpf: dto.cpf,
        description: dto.description,
        amount: dto.amount,
        paymentMethod: dto.paymentMethod,
      });

      // First call
      mockPaymentRepository.save.mockResolvedValue(mockPayment);
      const firstResult = await useCase.execute({ dto, idempotencyKey });
      expect(firstResult.isNew).toBe(true);

      // Second call with same key and body
      mockPaymentRepository.findById.mockResolvedValue(mockPayment);
      const secondResult = await useCase.execute({ dto, idempotencyKey });
      expect(secondResult.isNew).toBe(false);
      expect(secondResult.payment.id).toBe(mockPayment.id);
    });

    it("should throw conflict for same key with different body (Cenário 10)", async () => {
      const dto1: CreatePaymentDto = {
        cpf: "12345678909",
        description: "Mensalidade",
        amount: 199.9,
        paymentMethod: PaymentMethod.PIX,
      };

      const dto2: CreatePaymentDto = {
        cpf: "12345678909",
        description: "Mensalidade DIFERENTE",
        amount: 199.9,
        paymentMethod: PaymentMethod.PIX,
      };

      const idempotencyKey = "test-key-123";
      const mockPayment = Payment.create({
        cpf: dto1.cpf,
        description: dto1.description,
        amount: dto1.amount,
        paymentMethod: dto1.paymentMethod,
      });

      // First call
      mockPaymentRepository.save.mockResolvedValue(mockPayment);
      await useCase.execute({ dto: dto1, idempotencyKey });

      // Second call with different body should throw conflict
      await expect(
        useCase.execute({ dto: dto2, idempotencyKey }),
      ).rejects.toThrow("IDEMPOTENCY_KEY_CONFLICT");
    });
  });

  describe("Validation scenarios", () => {
    it("should validate CPF format (Cenário 5)", async () => {
      const dto: CreatePaymentDto = {
        cpf: "11111111111", // Invalid CPF
        description: "Mensalidade",
        amount: 199.9,
        paymentMethod: PaymentMethod.PIX,
      };

      await expect(useCase.execute({ dto })).rejects.toThrow("CPF inválido");
    });

    it("should validate amount is positive (Cenário 6)", async () => {
      const dto: CreatePaymentDto = {
        cpf: "12345678909",
        description: "Mensalidade",
        amount: -10, // Invalid amount
        paymentMethod: PaymentMethod.PIX,
      };

      // The use case now validates amount directly due to manual validation
      await expect(useCase.execute({ dto })).rejects.toThrow(
        "Amount deve ser um número positivo maior que 0.01",
      );
    });
  });

  describe("Error handling", () => {
    it("should handle repository errors", async () => {
      const dto: CreatePaymentDto = {
        cpf: "12345678909",
        description: "Mensalidade",
        amount: 199.9,
        paymentMethod: PaymentMethod.PIX,
      };

      mockPaymentRepository.save.mockRejectedValue(new Error("Database error"));

      await expect(useCase.execute({ dto })).rejects.toThrow("Database error");
    });

    it("should handle provider errors for CREDIT_CARD", async () => {
      const dto: CreatePaymentDto = {
        cpf: "12345678909",
        description: "Mensalidade",
        amount: 199.9,
        paymentMethod: PaymentMethod.CREDIT_CARD,
      };

      const idempotencyKey = "test-key-123";
      const mockPayment = Payment.create({
        cpf: dto.cpf,
        description: dto.description,
        amount: dto.amount,
        paymentMethod: dto.paymentMethod,
      });

      // Mock Temporal failure
      mockTemporalClient.startCreditCardPaymentWorkflow.mockRejectedValue(
        new Error("Temporal service unavailable"),
      );

      // Mock provider failure in fallback
      mockPaymentProvider.createCreditCardCharge.mockRejectedValue(
        new Error("Provider error"),
      );

      mockPaymentRepository.save.mockResolvedValue(mockPayment);

      // Should throw ServiceUnavailableException when both Temporal and provider fail
      await expect(useCase.execute({ dto, idempotencyKey })).rejects.toThrow(
        "Payment processing service unavailable",
      );
    });
  });
});
