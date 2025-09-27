import { ListPaymentsResponseDto } from "../list-payments-response.dto";
import { PaymentResponseDto } from "../payment-response.dto";
import {
  Payment,
  PaymentStatus,
  PaymentMethod,
} from "../../../domain/entities/payment.entity";

describe("ListPaymentsResponseDto", () => {
  describe("constructor", () => {
    it("should create response with correct properties", () => {
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

      const paymentDtos = mockPayments.map(
        (payment) => new PaymentResponseDto(payment.toJSON()),
      );

      const response = new ListPaymentsResponseDto(paymentDtos, 1, 20, 50);

      expect(response.items).toHaveLength(2);
      expect(response.page).toBe(1);
      expect(response.limit).toBe(20);
      expect(response.total).toBe(50);
      expect(response.hasNextPage).toBe(true);
    });

    it("should calculate hasNextPage correctly when there are more pages", () => {
      const mockPayments = [
        Payment.create({
          cpf: "12345678900",
          description: "Test Payment",
          amount: 100.0,
          paymentMethod: PaymentMethod.PIX,
        }),
      ];

      const paymentDtos = mockPayments.map(
        (payment) => new PaymentResponseDto(payment.toJSON()),
      );

      // page=1, limit=10, total=25 -> hasNextPage=true
      const response1 = new ListPaymentsResponseDto(paymentDtos, 1, 10, 25);
      expect(response1.hasNextPage).toBe(true);

      // page=2, limit=10, total=25 -> hasNextPage=true
      const response2 = new ListPaymentsResponseDto(paymentDtos, 2, 10, 25);
      expect(response2.hasNextPage).toBe(true);

      // page=3, limit=10, total=25 -> hasNextPage=false
      const response3 = new ListPaymentsResponseDto(paymentDtos, 3, 10, 25);
      expect(response3.hasNextPage).toBe(false);
    });

    it("should calculate hasNextPage correctly when there are no more pages", () => {
      const mockPayments = [
        Payment.create({
          cpf: "12345678900",
          description: "Test Payment",
          amount: 100.0,
          paymentMethod: PaymentMethod.PIX,
        }),
      ];

      const paymentDtos = mockPayments.map(
        (payment) => new PaymentResponseDto(payment.toJSON()),
      );

      // page=1, limit=10, total=10 -> hasNextPage=false
      const response1 = new ListPaymentsResponseDto(paymentDtos, 1, 10, 10);
      expect(response1.hasNextPage).toBe(false);

      // page=1, limit=20, total=5 -> hasNextPage=false
      const response2 = new ListPaymentsResponseDto(paymentDtos, 1, 20, 5);
      expect(response2.hasNextPage).toBe(false);
    });

    it("should handle empty items array", () => {
      const response = new ListPaymentsResponseDto([], 1, 20, 0);

      expect(response.items).toHaveLength(0);
      expect(response.page).toBe(1);
      expect(response.limit).toBe(20);
      expect(response.total).toBe(0);
      expect(response.hasNextPage).toBe(false);
    });

    it("should handle edge cases for hasNextPage calculation", () => {
      const mockPayments = [
        Payment.create({
          cpf: "12345678900",
          description: "Test Payment",
          amount: 100.0,
          paymentMethod: PaymentMethod.PIX,
        }),
      ];

      const paymentDtos = mockPayments.map(
        (payment) => new PaymentResponseDto(payment.toJSON()),
      );

      // page=1, limit=1, total=1 -> hasNextPage=false
      const response1 = new ListPaymentsResponseDto(paymentDtos, 1, 1, 1);
      expect(response1.hasNextPage).toBe(false);

      // page=1, limit=1, total=2 -> hasNextPage=true
      const response2 = new ListPaymentsResponseDto(paymentDtos, 1, 1, 2);
      expect(response2.hasNextPage).toBe(true);

      // page=2, limit=1, total=2 -> hasNextPage=false
      const response3 = new ListPaymentsResponseDto(paymentDtos, 2, 1, 2);
      expect(response3.hasNextPage).toBe(false);
    });

    it("should handle large numbers correctly", () => {
      const mockPayments = [
        Payment.create({
          cpf: "12345678900",
          description: "Test Payment",
          amount: 100.0,
          paymentMethod: PaymentMethod.PIX,
        }),
      ];

      const paymentDtos = mockPayments.map(
        (payment) => new PaymentResponseDto(payment.toJSON()),
      );

      // page=100, limit=100, total=10000 -> hasNextPage=true (100 * 100 = 10000 < 10000 is false, but 100 * 100 = 10000 = 10000 is false, so hasNextPage should be false)
      const response1 = new ListPaymentsResponseDto(
        paymentDtos,
        100,
        100,
        10000,
      );
      expect(response1.hasNextPage).toBe(false); // 100 * 100 = 10000, not < 10000

      // page=99, limit=100, total=10000 -> hasNextPage=true
      const response2 = new ListPaymentsResponseDto(
        paymentDtos,
        99,
        100,
        10000,
      );
      expect(response2.hasNextPage).toBe(true); // 99 * 100 = 9900 < 10000
    });

    it("should preserve all payment data in items", () => {
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

      const paymentDtos = mockPayments.map(
        (payment) => new PaymentResponseDto(payment.toJSON()),
      );

      const response = new ListPaymentsResponseDto(paymentDtos, 1, 20, 2);

      expect(response.items).toHaveLength(2);
      expect(response.items[0]).toBeInstanceOf(PaymentResponseDto);
      expect(response.items[1]).toBeInstanceOf(PaymentResponseDto);
      expect(response.items[0].cpf).toBe("12345678900");
      expect(response.items[1].cpf).toBe("12345678901");
    });
  });
});
