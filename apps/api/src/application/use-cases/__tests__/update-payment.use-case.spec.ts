import { describe, it, expect, beforeEach, vi } from "vitest";
import { UpdatePaymentUseCase } from "../update-payment.use-case";
import {
  Payment,
  PaymentMethod,
  PaymentStatus,
} from "../../../domain/entities/payment.entity";
import { DomainEventService } from "../../../domain/services/domain-event.service";
import { UpdatePaymentDto } from "../../../interfaces/dto/update-payment.dto";

describe("UpdatePaymentUseCase", () => {
  let useCase: UpdatePaymentUseCase;
  let mockPaymentRepository: any;
  let mockDomainEventService: DomainEventService;

  beforeEach(() => {
    mockPaymentRepository = {
      findById: vi.fn(),
      update: vi.fn(),
    };

    mockDomainEventService = new DomainEventService();

    useCase = new UpdatePaymentUseCase(
      mockPaymentRepository,
      mockDomainEventService,
    );
  });

  describe("Valid state transitions", () => {
    it("should update PENDING to PAID successfully (Cenário 1)", async () => {
      const paymentId = "pay_123";
      const dto: UpdatePaymentDto = { status: PaymentStatus.PAID };

      const existingPayment = Payment.create({
        cpf: "12345678909",
        description: "Mensalidade",
        amount: 199.9,
        paymentMethod: PaymentMethod.PIX,
      });

      mockPaymentRepository.findById.mockResolvedValue(existingPayment);
      mockPaymentRepository.update.mockResolvedValue(existingPayment);

      const result = await useCase.execute({ id: paymentId, dto });

      expect(result.statusChanged).toBe(true);
      expect(result.payment.status).toBe(PaymentStatus.PAID);
      expect(mockPaymentRepository.findById).toHaveBeenCalledWith(paymentId);
      expect(mockPaymentRepository.update).toHaveBeenCalledTimes(1);
    });

    it("should update PENDING to FAIL successfully (Cenário 2)", async () => {
      const paymentId = "pay_123";
      const dto: UpdatePaymentDto = { status: PaymentStatus.FAIL };

      const existingPayment = Payment.create({
        cpf: "12345678909",
        description: "Mensalidade",
        amount: 199.9,
        paymentMethod: PaymentMethod.PIX,
      });

      mockPaymentRepository.findById.mockResolvedValue(existingPayment);
      mockPaymentRepository.update.mockResolvedValue(existingPayment);

      const result = await useCase.execute({ id: paymentId, dto });

      expect(result.statusChanged).toBe(true);
      expect(result.payment.status).toBe(PaymentStatus.FAIL);
      expect(mockPaymentRepository.update).toHaveBeenCalledTimes(1);
    });

    it("should handle idempotent update (same status) (Cenário 3)", async () => {
      const paymentId = "pay_123";
      const dto: UpdatePaymentDto = { status: PaymentStatus.PAID };

      const existingPayment = Payment.create({
        cpf: "12345678909",
        description: "Mensalidade",
        amount: 199.9,
        paymentMethod: PaymentMethod.PIX,
      });

      existingPayment.transitionTo(PaymentStatus.PAID);

      mockPaymentRepository.findById.mockResolvedValue(existingPayment);
      mockPaymentRepository.update.mockResolvedValue(existingPayment);

      const result = await useCase.execute({ id: paymentId, dto });

      expect(result.statusChanged).toBe(false);
      expect(result.payment.status).toBe(PaymentStatus.PAID);
      expect(mockPaymentRepository.update).toHaveBeenCalledTimes(1);
    });
  });

  describe("Invalid state transitions", () => {
    it("should reject PAID to PENDING transition (Cenário 4)", async () => {
      const paymentId = "pay_123";
      const dto: UpdatePaymentDto = { status: PaymentStatus.PENDING };

      const existingPayment = Payment.create({
        cpf: "12345678909",
        description: "Mensalidade",
        amount: 199.9,
        paymentMethod: PaymentMethod.PIX,
      });

      existingPayment.transitionTo(PaymentStatus.PAID);

      mockPaymentRepository.findById.mockResolvedValue(existingPayment);

      await expect(useCase.execute({ id: paymentId, dto })).rejects.toThrow(
        "Invalid state transition from PAID to PENDING",
      );

      expect(mockPaymentRepository.update).not.toHaveBeenCalled();
    });

    it("should reject FAIL to PENDING transition (Cenário 5)", async () => {
      const paymentId = "pay_123";
      const dto: UpdatePaymentDto = { status: PaymentStatus.PENDING };

      const existingPayment = Payment.create({
        cpf: "12345678909",
        description: "Mensalidade",
        amount: 199.9,
        paymentMethod: PaymentMethod.PIX,
      });

      existingPayment.transitionTo(PaymentStatus.FAIL);

      mockPaymentRepository.findById.mockResolvedValue(existingPayment);

      await expect(useCase.execute({ id: paymentId, dto })).rejects.toThrow(
        "Invalid state transition from FAIL to PENDING",
      );

      expect(mockPaymentRepository.update).not.toHaveBeenCalled();
    });

    it("should reject PAID to FAIL transition (Cenário 6)", async () => {
      const paymentId = "pay_123";
      const dto: UpdatePaymentDto = { status: PaymentStatus.FAIL };

      const existingPayment = Payment.create({
        cpf: "12345678909",
        description: "Mensalidade",
        amount: 199.9,
        paymentMethod: PaymentMethod.PIX,
      });

      existingPayment.transitionTo(PaymentStatus.PAID);

      mockPaymentRepository.findById.mockResolvedValue(existingPayment);

      await expect(useCase.execute({ id: paymentId, dto })).rejects.toThrow(
        "Invalid state transition from PAID to FAIL",
      );

      expect(mockPaymentRepository.update).not.toHaveBeenCalled();
    });
  });

  describe("Error handling", () => {
    it("should throw NotFoundException when payment not found (Cenário 7)", async () => {
      const paymentId = "pay_nonexistent";
      const dto: UpdatePaymentDto = { status: PaymentStatus.PAID };

      mockPaymentRepository.findById.mockResolvedValue(null);

      await expect(useCase.execute({ id: paymentId, dto })).rejects.toThrow(
        "Payment not found",
      );

      expect(mockPaymentRepository.update).not.toHaveBeenCalled();
    });

    it("should handle repository errors", async () => {
      const paymentId = "pay_123";
      const dto: UpdatePaymentDto = { status: PaymentStatus.PAID };

      const existingPayment = Payment.create({
        cpf: "12345678909",
        description: "Mensalidade",
        amount: 199.9,
        paymentMethod: PaymentMethod.PIX,
      });

      mockPaymentRepository.findById.mockResolvedValue(existingPayment);
      mockPaymentRepository.update.mockRejectedValue(
        new Error("Database error"),
      );

      await expect(useCase.execute({ id: paymentId, dto })).rejects.toThrow(
        "Database error",
      );
    });
  });

  describe("Domain events", () => {
    it("should add domain event when status changes", async () => {
      const paymentId = "pay_123";
      const dto: UpdatePaymentDto = { status: PaymentStatus.PAID };

      const existingPayment = Payment.create({
        cpf: "12345678909",
        description: "Mensalidade",
        amount: 199.9,
        paymentMethod: PaymentMethod.PIX,
      });

      mockPaymentRepository.findById.mockResolvedValue(existingPayment);
      mockPaymentRepository.update.mockResolvedValue(existingPayment);

      await useCase.execute({ id: paymentId, dto });

      expect(mockDomainEventService.hasEvents()).toBe(true);
      const events = mockDomainEventService.getEvents();
      expect(events).toHaveLength(1);
    });

    it("should not add domain event when status does not change", async () => {
      const paymentId = "pay_123";
      const dto: UpdatePaymentDto = { status: PaymentStatus.PAID };

      const existingPayment = Payment.create({
        cpf: "12345678909",
        description: "Mensalidade",
        amount: 199.9,
        paymentMethod: PaymentMethod.PIX,
      });

      existingPayment.transitionTo(PaymentStatus.PAID);

      mockPaymentRepository.findById.mockResolvedValue(existingPayment);
      mockPaymentRepository.update.mockResolvedValue(existingPayment);

      await useCase.execute({ id: paymentId, dto });

      expect(mockDomainEventService.hasEvents()).toBe(false);
    });
  });
});
