import { Test, TestingModule } from "@nestjs/testing";
import {
  BadRequestException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { CreatePaymentUseCase } from "../create-payment.use-case";
import { PaymentRepository } from "../../ports/payment.repository.port";
import { PaymentProvider } from "../../ports/payment-provider.port";
import { IdempotencyService } from "../../../domain/services/idempotency.service";
import { TemporalClientService } from "../../../infra/workflows/temporal-client";
import { CreatePaymentDto } from "../../../interfaces/dto/create-payment.dto";
import {
  Payment,
  PaymentMethod,
} from "../../../domain/entities/payment.entity";
import { vi } from "vitest";

describe("CreatePaymentUseCase with Temporal Integration", () => {
  let useCase: CreatePaymentUseCase;
  let mockPaymentRepository: any;
  let mockPaymentProvider: any;
  let mockIdempotencyService: any;
  let mockTemporalClient: any;

  beforeEach(async () => {
    mockPaymentRepository = {
      save: vi.fn(),
      findById: vi.fn(),
      update: vi.fn(),
    } as any;

    mockPaymentProvider = {
      createCreditCardCharge: vi.fn(),
    } as any;

    mockIdempotencyService = {
      checkKey: vi.fn(),
      storeKey: vi.fn(),
      generateBodyHash: vi.fn(),
    } as any;

    mockTemporalClient = {
      startCreditCardPaymentWorkflow: vi.fn(),
      signalPaymentStatus: vi.fn(),
      getPaymentStatus: vi.fn(),
      getWorkflowResult: vi.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreatePaymentUseCase,
        {
          provide: "PaymentRepository",
          useValue: mockPaymentRepository,
        },
        {
          provide: "PaymentProvider",
          useValue: mockPaymentProvider,
        },
        {
          provide: IdempotencyService,
          useValue: mockIdempotencyService,
        },
        {
          provide: TemporalClientService,
          useValue: mockTemporalClient,
        },
      ],
    }).compile();

    useCase = module.get<CreatePaymentUseCase>(CreatePaymentUseCase);
    vi.clearAllMocks();
  });

  describe("CREDIT_CARD payments with Temporal", () => {
    const creditCardDto: CreatePaymentDto = {
      cpf: "12345678900",
      description: "Test credit card payment",
      amount: 100.5,
      paymentMethod: PaymentMethod.CREDIT_CARD,
    };

    const idempotencyKey = "idem_123";

    beforeEach(() => {
      mockIdempotencyService.generateBodyHash.mockReturnValue("hash_123");
      mockIdempotencyService.checkKey.mockReturnValue({
        isNew: true,
        paymentId: null,
      });
    });

    it("should start Temporal workflow for CREDIT_CARD payment", async () => {
      const mockWorkflowResult = {
        workflowId: "credit-card-payment-pay_123",
        runId: "run_456",
      };

      mockTemporalClient.startCreditCardPaymentWorkflow.mockResolvedValue(
        mockWorkflowResult,
      );

      const mockPayment = {
        id: "pay_123",
        cpf: "12345678900",
        description: "Test credit card payment",
        amount: 100.5,
        paymentMethod: "CREDIT_CARD",
        status: "PENDING",
        toJSON: vi.fn().mockReturnValue({
          id: "pay_123",
          cpf: "12345678900",
          description: "Test credit card payment",
          amount: 100.5,
          paymentMethod: "CREDIT_CARD",
          status: "PENDING",
        }),
      };

      mockPaymentRepository.save.mockResolvedValue(mockPayment as any);

      const result = await useCase.execute({
        dto: creditCardDto,
        idempotencyKey,
      });

      expect(
        mockTemporalClient.startCreditCardPaymentWorkflow,
      ).toHaveBeenCalledWith({
        paymentId: expect.any(String),
        cpf: "12345678900",
        description: "Test credit card payment",
        amount: 100.5,
        idempotencyKey: "idem_123",
      });

      expect(result.payment).toBeDefined();
      expect(result.isNew).toBe(true);
    });

    it("should fallback to direct provider call when Temporal fails", async () => {
      const temporalError = new Error("Temporal service unavailable");
      mockTemporalClient.startCreditCardPaymentWorkflow.mockRejectedValue(
        temporalError,
      );

      const mockProviderResult = {
        providerRef: "mp_fallback_123",
      };

      mockPaymentProvider.createCreditCardCharge.mockResolvedValue(
        mockProviderResult,
      );

      const mockPayment = {
        id: "pay_123",
        cpf: "12345678900",
        description: "Test credit card payment",
        amount: 100.5,
        paymentMethod: "CREDIT_CARD",
        status: "PENDING",
        setProviderRef: vi.fn(),
        toJSON: vi.fn().mockReturnValue({
          id: "pay_123",
          cpf: "12345678900",
          description: "Test credit card payment",
          amount: 100.5,
          paymentMethod: "CREDIT_CARD",
          status: "PENDING",
          providerRef: "mp_fallback_123",
        }),
      };

      mockPaymentRepository.save.mockResolvedValue(mockPayment as any);

      const result = await useCase.execute({
        dto: creditCardDto,
        idempotencyKey,
      });

      expect(mockPaymentProvider.createCreditCardCharge).toHaveBeenCalledWith({
        amount: 100.5,
        description: "Test credit card payment",
        idempotencyKey: "idem_123",
        cpf: "12345678900",
      });

      expect(mockPayment.setProviderRef).toHaveBeenCalledWith(
        "mp_fallback_123",
      );
      expect(result.payment).toBeDefined();
    });

    it("should throw ServiceUnavailableException when both Temporal and fallback fail", async () => {
      const temporalError = new Error("Temporal service unavailable");
      mockTemporalClient.startCreditCardPaymentWorkflow.mockRejectedValue(
        temporalError,
      );

      const providerError = new Error("Provider service unavailable");
      mockPaymentProvider.createCreditCardCharge.mockRejectedValue(
        providerError,
      );

      await expect(
        useCase.execute({
          dto: creditCardDto,
          idempotencyKey,
        }),
      ).rejects.toThrow(ServiceUnavailableException);
    });

    it("should handle Temporal workflow timeout gracefully", async () => {
      const timeoutError = new Error("Temporal workflow timeout");
      mockTemporalClient.startCreditCardPaymentWorkflow.mockRejectedValue(
        timeoutError,
      );

      const mockProviderResult = {
        providerRef: "mp_timeout_fallback_123",
      };

      mockPaymentProvider.createCreditCardCharge.mockResolvedValue(
        mockProviderResult,
      );

      const mockPayment = {
        id: "pay_123",
        cpf: "12345678900",
        description: "Test credit card payment",
        amount: 100.5,
        paymentMethod: "CREDIT_CARD",
        status: "PENDING",
        setProviderRef: vi.fn(),
        toJSON: vi.fn().mockReturnValue({
          id: "pay_123",
          cpf: "12345678900",
          description: "Test credit card payment",
          amount: 100.5,
          paymentMethod: "CREDIT_CARD",
          status: "PENDING",
          providerRef: "mp_timeout_fallback_123",
        }),
      };

      mockPaymentRepository.save.mockResolvedValue(mockPayment as any);

      const result = await useCase.execute({
        dto: creditCardDto,
        idempotencyKey,
      });

      expect(result.payment).toBeDefined();
      expect(mockPayment.setProviderRef).toHaveBeenCalledWith(
        "mp_timeout_fallback_123",
      );
    });
  });

  describe("PIX payments (no Temporal)", () => {
    const pixDto: CreatePaymentDto = {
      cpf: "12345678900",
      description: "Test PIX payment",
      amount: 50.0,
      paymentMethod: PaymentMethod.PIX,
    };

    beforeEach(() => {
      mockIdempotencyService.generateBodyHash.mockReturnValue("hash_123");
      mockIdempotencyService.checkKey.mockReturnValue({
        isNew: true,
        paymentId: null,
      });
    });

    it("should not start Temporal workflow for PIX payment", async () => {
      const mockPayment = {
        id: "pay_123",
        cpf: "12345678900",
        description: "Test PIX payment",
        amount: 50.0,
        paymentMethod: PaymentMethod.PIX,
        status: "PENDING",
        toJSON: vi.fn().mockReturnValue({
          id: "pay_123",
          cpf: "12345678900",
          description: "Test PIX payment",
          amount: 50.0,
          paymentMethod: PaymentMethod.PIX,
          status: "PENDING",
        }),
      };

      mockPaymentRepository.save.mockResolvedValue(mockPayment as any);

      const result = await useCase.execute({
        dto: pixDto,
      });

      expect(
        mockTemporalClient.startCreditCardPaymentWorkflow,
      ).not.toHaveBeenCalled();
      expect(mockPaymentProvider.createCreditCardCharge).not.toHaveBeenCalled();
      expect(result.payment).toBeDefined();
      expect(result.isNew).toBe(true);
    });
  });

  describe("validation with Temporal integration", () => {
    it("should require Idempotency-Key for CREDIT_CARD payments", async () => {
      const creditCardDto: CreatePaymentDto = {
        cpf: "12345678900",
        description: "Test credit card payment",
        amount: 100.5,
        paymentMethod: PaymentMethod.CREDIT_CARD,
      };

      await expect(
        useCase.execute({
          dto: creditCardDto,
          // No idempotencyKey provided
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("should allow PIX payments without Idempotency-Key", async () => {
      const pixDto: CreatePaymentDto = {
        cpf: "12345678900",
        description: "Test PIX payment",
        amount: 50.0,
        paymentMethod: PaymentMethod.PIX,
      };

      mockIdempotencyService.generateBodyHash.mockReturnValue("hash_123");
      mockIdempotencyService.checkKey.mockReturnValue({
        isNew: true,
        paymentId: null,
      });

      const mockPayment = {
        id: "pay_123",
        cpf: "12345678900",
        description: "Test PIX payment",
        amount: 50.0,
        paymentMethod: PaymentMethod.PIX,
        status: "PENDING",
        toJSON: vi.fn().mockReturnValue({
          id: "pay_123",
          cpf: "12345678900",
          description: "Test PIX payment",
          amount: 50.0,
          paymentMethod: PaymentMethod.PIX,
          status: "PENDING",
        }),
      };

      mockPaymentRepository.save.mockResolvedValue(mockPayment as any);

      const result = await useCase.execute({
        dto: pixDto,
      });

      expect(result.payment).toBeDefined();
      expect(result.isNew).toBe(true);
    });
  });

  describe("idempotency with Temporal", () => {
    it("should handle idempotency for CREDIT_CARD payments", async () => {
      const creditCardDto: CreatePaymentDto = {
        cpf: "12345678900",
        description: "Test credit card payment",
        amount: 100.5,
        paymentMethod: PaymentMethod.CREDIT_CARD,
      };

      const idempotencyKey = "idem_123";

      mockIdempotencyService.generateBodyHash.mockReturnValue("hash_123");
      mockIdempotencyService.checkKey.mockReturnValue({
        isNew: false,
        paymentId: "existing_pay_123",
      });

      const existingPayment = {
        id: "existing_pay_123",
        cpf: "12345678900",
        description: "Test credit card payment",
        amount: 100.5,
        paymentMethod: PaymentMethod.CREDIT_CARD,
        status: "PENDING",
        toJSON: vi.fn().mockReturnValue({
          id: "existing_pay_123",
          cpf: "12345678900",
          description: "Test credit card payment",
          amount: 100.5,
          paymentMethod: PaymentMethod.CREDIT_CARD,
          status: "PENDING",
        }),
      };

      mockPaymentRepository.findById.mockResolvedValue(existingPayment as any);

      const result = await useCase.execute({
        dto: creditCardDto,
        idempotencyKey,
      });

      expect(
        mockTemporalClient.startCreditCardPaymentWorkflow,
      ).not.toHaveBeenCalled();
      expect(result.payment).toBe(existingPayment);
      expect(result.isNew).toBe(false);
    });
  });

  describe("error handling with Temporal", () => {
    it("should handle Temporal connection errors", async () => {
      const creditCardDto: CreatePaymentDto = {
        cpf: "12345678900",
        description: "Test credit card payment",
        amount: 100.5,
        paymentMethod: PaymentMethod.CREDIT_CARD,
      };

      const idempotencyKey = "idem_123";

      mockIdempotencyService.generateBodyHash.mockReturnValue("hash_123");
      mockIdempotencyService.checkKey.mockReturnValue({
        isNew: true,
        paymentId: null,
      });

      const connectionError = new Error("Temporal connection failed");
      mockTemporalClient.startCreditCardPaymentWorkflow.mockRejectedValue(
        connectionError,
      );

      const mockProviderResult = {
        providerRef: "mp_connection_fallback_123",
      };

      mockPaymentProvider.createCreditCardCharge.mockResolvedValue(
        mockProviderResult,
      );

      const mockPayment = {
        id: "pay_123",
        cpf: "12345678900",
        description: "Test credit card payment",
        amount: 100.5,
        paymentMethod: "CREDIT_CARD",
        status: "PENDING",
        setProviderRef: vi.fn(),
        toJSON: vi.fn().mockReturnValue({
          id: "pay_123",
          cpf: "12345678900",
          description: "Test credit card payment",
          amount: 100.5,
          paymentMethod: "CREDIT_CARD",
          status: "PENDING",
          providerRef: "mp_connection_fallback_123",
        }),
      };

      mockPaymentRepository.save.mockResolvedValue(mockPayment as any);

      const result = await useCase.execute({
        dto: creditCardDto,
        idempotencyKey,
      });

      expect(result.payment).toBeDefined();
      expect(mockPayment.setProviderRef).toHaveBeenCalledWith(
        "mp_connection_fallback_123",
      );
    });
  });
});
