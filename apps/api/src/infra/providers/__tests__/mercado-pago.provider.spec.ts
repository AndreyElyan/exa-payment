import { Test, TestingModule } from "@nestjs/testing";
import { Logger } from "@nestjs/common";
import {
  MercadoPagoProvider,
  MercadoPagoConfig,
} from "../mercado-pago.provider";
import { CreateCreditCardChargeInput } from "../../../application/ports/payment-provider.port";
import { vi } from "vitest";

// Mock fetch global
global.fetch = vi.fn();

describe("MercadoPagoProvider", () => {
  let provider: MercadoPagoProvider;
  let config: MercadoPagoConfig;

  beforeEach(async () => {
    config = {
      accessToken: "test-token",
      baseUrl: "https://api.mercadopago.com",
      timeout: 3000,
      maxRetries: 3,
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: MercadoPagoProvider,
          useFactory: () => new MercadoPagoProvider(config),
        },
      ],
    }).compile();

    provider = module.get<MercadoPagoProvider>(MercadoPagoProvider);
    vi.clearAllMocks();
  });

  describe("createCreditCardCharge", () => {
    const validInput: CreateCreditCardChargeInput = {
      amount: 100.5,
      description: "Test payment",
      idempotencyKey: "test-key-123",
      cpf: "12345678900",
    };

    it("should create credit card charge successfully", async () => {
      const mockResponse = {
        id: "mp_123456789",
        init_point:
          "https://www.mercadopago.com/checkout/start?pref_id=mp_123456789",
        sandbox_init_point:
          "https://sandbox.mercadopago.com/checkout/pay?pref_id=mp_123456789",
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await provider.createCreditCardCharge(validInput);

      expect(result).toEqual({
        providerRef: "mp_123456789",
      });

      expect(global.fetch).toHaveBeenCalledWith(
        "https://api.mercadopago.com/checkout/preferences",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            Authorization: "Bearer test-token",
            "X-Idempotency-Key": "test-key-123",
          }),
          body: expect.stringContaining('"currency_id":"BRL"'),
        }),
      );
    });

    it("should retry on failure with exponential backoff", async () => {
      const mockError = new Error("Network error");

      (global.fetch as any)
        .mockRejectedValueOnce(mockError)
        .mockRejectedValueOnce(mockError)
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ id: "mp_retry_success" }),
        });

      const result = await provider.createCreditCardCharge(validInput);

      expect(result).toEqual({
        providerRef: "mp_retry_success",
      });

      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it("should fail after max retries", async () => {
      const mockError = new Error("Persistent network error");

      (global.fetch as any).mockRejectedValue(mockError);

      await expect(provider.createCreditCardCharge(validInput)).rejects.toThrow(
        "Failed to create preference after 3 attempts: Persistent network error",
      );

      expect(global.fetch).toHaveBeenCalledTimes(3);
    });

    it("should handle timeout correctly", async () => {
      const mockError = new Error("Request timeout after 3000ms");
      mockError.name = "AbortError";

      (global.fetch as any).mockRejectedValue(mockError);

      await expect(provider.createCreditCardCharge(validInput)).rejects.toThrow(
        "Request timeout after 3000ms",
      );
    });

    it("should handle HTTP error responses", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: () => Promise.resolve("Invalid request"),
      });

      await expect(provider.createCreditCardCharge(validInput)).rejects.toThrow(
        "Failed to create preference after 3 attempts: HTTP 400: Invalid request",
      );
    });

    it("should include CPF in payer identification", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: "mp_test" }),
      });

      await provider.createCreditCardCharge(validInput);

      const callArgs = (global.fetch as any).mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);

      expect(requestBody.payer.identification).toEqual({
        type: "CPF",
        number: "12345678900",
      });
    });

    it("should exclude ticket payment type", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: "mp_test" }),
      });

      await provider.createCreditCardCharge(validInput);

      const callArgs = (global.fetch as any).mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);

      expect(requestBody.payment_methods.excluded_payment_types).toEqual([
        { id: "ticket" },
      ]);
    });

    it("should set external_reference as idempotency key", async () => {
      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: "mp_test" }),
      });

      await provider.createCreditCardCharge(validInput);

      const callArgs = (global.fetch as any).mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);

      expect(requestBody.external_reference).toBe("test-key-123");
    });

    it("should handle missing CPF gracefully", async () => {
      const inputWithoutCpf = { ...validInput, cpf: undefined };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: "mp_test" }),
      });

      await provider.createCreditCardCharge(inputWithoutCpf);

      const callArgs = (global.fetch as any).mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);

      expect(requestBody.payer.identification.number).toBe("00000000000");
    });
  });

  describe("request payload structure", () => {
    it("should create correct payload structure", async () => {
      const validInput: CreateCreditCardChargeInput = {
        amount: 100.5,
        description: "Test payment",
        idempotencyKey: "test-key-123",
        cpf: "12345678900",
      };

      (global.fetch as any).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: "mp_test" }),
      });

      await provider.createCreditCardCharge(validInput);

      const callArgs = (global.fetch as any).mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);

      expect(requestBody).toMatchObject({
        items: [
          {
            id: expect.stringMatching(/^payment-\d+$/),
            title: "Test payment",
            description: "Test payment",
            quantity: 1,
            currency_id: "BRL",
            unit_price: 100.5,
          },
        ],
        payer: {
          identification: {
            type: "CPF",
            number: "12345678900",
          },
        },
        payment_methods: {
          excluded_payment_types: [{ id: "ticket" }],
          installments: 12,
          default_installments: 1,
        },
        external_reference: "test-key-123",
        expires: false,
      });
    });
  });
});
