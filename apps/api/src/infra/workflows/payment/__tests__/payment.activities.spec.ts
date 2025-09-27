import { Test, TestingModule } from "@nestjs/testing";
import { Logger } from "@nestjs/common";
import { PaymentActivitiesImpl } from "../payment.activities";
import { PaymentRepository } from "../../../../application/ports/payment.repository.port";
import { PaymentProvider } from "../../../../application/ports/payment-provider.port";
import { DomainEventService } from "../../../../domain/services/domain-event.service";
import { Payment } from "../../../../domain/entities/payment.entity";
import { vi } from "vitest";

describe("PaymentActivitiesImpl", () => {
  let activities: PaymentActivitiesImpl;
  let mockPaymentRepository: any;
  let mockPaymentProvider: any;
  let mockDomainEventService: any;

  beforeEach(async () => {
    mockPaymentRepository = {
      save: vi.fn(),
      findById: vi.fn(),
      update: vi.fn(),
    } as any;

    mockPaymentProvider = {
      createCreditCardCharge: vi.fn(),
    } as any;

    mockDomainEventService = {
      publishPaymentStatusChanged: vi.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: PaymentActivitiesImpl,
          useFactory: () =>
            new PaymentActivitiesImpl(
              mockPaymentRepository,
              mockPaymentProvider,
              mockDomainEventService,
            ),
        },
      ],
    }).compile();

    activities = module.get<PaymentActivitiesImpl>(PaymentActivitiesImpl);
    vi.clearAllMocks();
  });

  describe("createPaymentRecord", () => {
    it("should create payment record successfully", async () => {
      const input = {
        paymentId: "pay_123",
        cpf: "12345678900",
        description: "Test payment",
        amount: 100.5,
        status: "PENDING" as const,
      };

      const mockPayment = {
        id: "pay_123",
        cpf: "12345678900",
        description: "Test payment",
        amount: 100.5,
        paymentMethod: "CREDIT_CARD",
        status: "PENDING",
      };

      mockPaymentRepository.save.mockResolvedValue(mockPayment as any);

      await activities.createPaymentRecord(input);

      expect(mockPaymentRepository.save).toHaveBeenCalledWith(
        expect.objectContaining({
          cpf: "12345678900",
          description: "Test payment",
          amount: 100.5,
          paymentMethod: "CREDIT_CARD",
          status: "PENDING",
        }),
      );
    });

    it("should handle payment creation errors", async () => {
      const input = {
        paymentId: "pay_123",
        cpf: "12345678900",
        description: "Test payment",
        amount: 100.5,
        status: "PENDING" as const,
      };

      const error = new Error("Database error");
      mockPaymentRepository.save.mockRejectedValue(error);

      await expect(activities.createPaymentRecord(input)).rejects.toThrow(
        "Database error",
      );
    });
  });

  describe("createMercadoPagoPreference", () => {
    it("should create Mercado Pago preference successfully", async () => {
      const input = {
        cpf: "12345678900",
        description: "Test payment",
        amount: 100.5,
        idempotencyKey: "idem_123",
      };

      const mockResult = {
        providerRef: "mp_123456789",
        initPoint:
          "https://www.mercadopago.com/checkout/start?pref_id=mp_123456789",
      };

      mockPaymentProvider.createCreditCardCharge.mockResolvedValue({
        providerRef: "mp_123456789",
        initPoint:
          "https://www.mercadopago.com/checkout/start?pref_id=mp_123456789",
      });

      const result = await activities.createMercadoPagoPreference(input);

      expect(result).toEqual(mockResult);
      expect(mockPaymentProvider.createCreditCardCharge).toHaveBeenCalledWith({
        cpf: "12345678900",
        description: "Test payment",
        amount: 100.5,
        idempotencyKey: "idem_123",
      });
    });

    it("should handle provider errors", async () => {
      const input = {
        cpf: "12345678900",
        description: "Test payment",
        amount: 100.5,
        idempotencyKey: "idem_123",
      };

      const error = new Error("Mercado Pago API error");
      mockPaymentProvider.createCreditCardCharge.mockRejectedValue(error);

      await expect(
        activities.createMercadoPagoPreference(input),
      ).rejects.toThrow("Mercado Pago API error");
    });
  });

  describe("updatePaymentStatus", () => {
    it("should update payment status successfully", async () => {
      const input = {
        paymentId: "pay_123",
        status: "PAID" as const,
        providerRef: "mp_123456789",
      };

      const mockPayment = {
        id: "pay_123",
        status: "PENDING",
        setProviderRef: vi.fn(),
        transitionTo: vi.fn(),
      };

      mockPaymentRepository.findById.mockResolvedValue(mockPayment as any);
      mockPaymentRepository.update.mockResolvedValue(mockPayment as any);

      await activities.updatePaymentStatus(input);

      expect(mockPaymentRepository.findById).toHaveBeenCalledWith("pay_123");
      expect(mockPayment.setProviderRef).toHaveBeenCalledWith("mp_123456789");
      expect(mockPayment.transitionTo).toHaveBeenCalledWith("PAID");
      expect(mockPaymentRepository.update).toHaveBeenCalledWith(mockPayment);
    });

    it("should handle payment not found", async () => {
      const input = {
        paymentId: "pay_nonexistent",
        status: "PAID" as const,
      };

      mockPaymentRepository.findById.mockResolvedValue(null);

      await expect(activities.updatePaymentStatus(input)).rejects.toThrow(
        "Payment not found: pay_nonexistent",
      );
    });

    it("should update without providerRef if not provided", async () => {
      const input = {
        paymentId: "pay_123",
        status: "FAIL" as const,
      };

      const mockPayment = {
        id: "pay_123",
        status: "PENDING",
        setProviderRef: vi.fn(),
        transitionTo: vi.fn(),
      };

      mockPaymentRepository.findById.mockResolvedValue(mockPayment as any);
      mockPaymentRepository.update.mockResolvedValue(mockPayment as any);

      await activities.updatePaymentStatus(input);

      expect(mockPayment.setProviderRef).not.toHaveBeenCalled();
      expect(mockPayment.transitionTo).toHaveBeenCalledWith("FAIL");
    });
  });

  describe("checkPaymentStatus", () => {
    it("should check payment status successfully when provider supports it", async () => {
      const input = {
        providerRef: "mp_123456789",
      };

      const mockProviderWithStatus = {
        getPaymentStatus: vi.fn().mockResolvedValue("PAID"),
      };

      mockPaymentProvider.getPaymentStatus =
        mockProviderWithStatus.getPaymentStatus;

      const result = await activities.checkPaymentStatus(input);

      expect(result).toBe("PAID");
      expect(mockProviderWithStatus.getPaymentStatus).toHaveBeenCalledWith(
        "mp_123456789",
      );
    });

    it("should return null when provider does not support status checking", async () => {
      const input = {
        providerRef: "mp_123456789",
      };

      const result = await activities.checkPaymentStatus(input);

      expect(result).toBeNull();
    });

    it("should handle provider status check errors gracefully", async () => {
      const input = {
        providerRef: "mp_123456789",
      };

      const mockProviderWithStatus = {
        getPaymentStatus: vi
          .fn()
          .mockRejectedValue(new Error("Provider error")),
      };

      mockPaymentProvider.getPaymentStatus =
        mockProviderWithStatus.getPaymentStatus;

      const result = await activities.checkPaymentStatus(input);

      expect(result).toBeNull();
    });
  });

  describe("publishStatusChangeEvent", () => {
    it("should publish status change event when status changes", async () => {
      const input = {
        paymentId: "pay_123",
        oldStatus: "PENDING" as const,
        newStatus: "PAID" as const,
      };

      await activities.publishStatusChangeEvent(input);

      expect(
        mockDomainEventService.publishPaymentStatusChanged,
      ).toHaveBeenCalledWith({
        paymentId: "pay_123",
        oldStatus: "PENDING",
        newStatus: "PAID",
        occurredAt: expect.any(Date),
      });
    });

    it("should not publish event when status does not change", async () => {
      const input = {
        paymentId: "pay_123",
        oldStatus: "PENDING" as const,
        newStatus: "PENDING" as const,
      };

      await activities.publishStatusChangeEvent(input);

      expect(
        mockDomainEventService.publishPaymentStatusChanged,
      ).not.toHaveBeenCalled();
    });

    it("should handle event publishing errors", async () => {
      const input = {
        paymentId: "pay_123",
        oldStatus: "PENDING" as const,
        newStatus: "PAID" as const,
      };

      const error = new Error("Event publishing failed");
      mockDomainEventService.publishPaymentStatusChanged.mockRejectedValue(
        error,
      );

      await expect(activities.publishStatusChangeEvent(input)).rejects.toThrow(
        "Event publishing failed",
      );
    });
  });

  describe("integration scenarios", () => {
    it("should handle complete payment flow", async () => {
      // Create payment record
      const createInput = {
        paymentId: "pay_123",
        cpf: "12345678900",
        description: "Test payment",
        amount: 100.5,
        status: "PENDING" as const,
      };

      const mockPayment = {
        id: "pay_123",
        cpf: "12345678900",
        description: "Test payment",
        amount: 100.5,
        paymentMethod: "CREDIT_CARD",
        status: "PENDING",
      };

      mockPaymentRepository.save.mockResolvedValue(mockPayment as any);

      await activities.createPaymentRecord(createInput);
      expect(mockPaymentRepository.save).toHaveBeenCalled();

      // Create Mercado Pago preference
      const preferenceInput = {
        cpf: "12345678900",
        description: "Test payment",
        amount: 100.5,
        idempotencyKey: "idem_123",
      };

      mockPaymentProvider.createCreditCardCharge.mockResolvedValue({
        providerRef: "mp_123456789",
        initPoint:
          "https://www.mercadopago.com/checkout/start?pref_id=mp_123456789",
      });

      const preferenceResult =
        await activities.createMercadoPagoPreference(preferenceInput);
      expect(preferenceResult.providerRef).toBe("mp_123456789");

      // Update payment status
      const updateInput = {
        paymentId: "pay_123",
        status: "PAID" as const,
        providerRef: "mp_123456789",
      };

      const mockPaymentForUpdate = {
        id: "pay_123",
        status: "PENDING",
        setProviderRef: vi.fn(),
        transitionTo: vi.fn(),
      };

      mockPaymentRepository.findById.mockResolvedValue(
        mockPaymentForUpdate as any,
      );
      mockPaymentRepository.update.mockResolvedValue(
        mockPaymentForUpdate as any,
      );

      await activities.updatePaymentStatus(updateInput);
      expect(mockPaymentForUpdate.transitionTo).toHaveBeenCalledWith("PAID");

      // Publish status change event
      const eventInput = {
        paymentId: "pay_123",
        oldStatus: "PENDING" as const,
        newStatus: "PAID" as const,
      };

      await activities.publishStatusChangeEvent(eventInput);
      expect(
        mockDomainEventService.publishPaymentStatusChanged,
      ).toHaveBeenCalled();
    });
  });
});
