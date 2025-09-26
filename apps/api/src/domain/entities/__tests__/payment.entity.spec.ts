import { describe, it, expect } from "vitest";
import { Payment, PaymentMethod, PaymentStatus } from "../payment.entity";

describe("Payment Entity - State Machine", () => {
  describe("Valid transitions", () => {
    it("should allow PENDING to PAID transition", () => {
      const payment = Payment.create({
        cpf: "12345678909",
        description: "Mensalidade",
        amount: 199.9,
        paymentMethod: PaymentMethod.PIX,
      });

      expect(payment.status).toBe(PaymentStatus.PENDING);

      payment.transitionTo(PaymentStatus.PAID);

      expect(payment.status).toBe(PaymentStatus.PAID);
    });

    it("should allow PENDING to FAIL transition", () => {
      const payment = Payment.create({
        cpf: "12345678909",
        description: "Mensalidade",
        amount: 199.9,
        paymentMethod: PaymentMethod.PIX,
      });

      expect(payment.status).toBe(PaymentStatus.PENDING);

      payment.transitionTo(PaymentStatus.FAIL);

      expect(payment.status).toBe(PaymentStatus.FAIL);
    });

    it("should be idempotent when transitioning to same status", () => {
      const payment = Payment.create({
        cpf: "12345678909",
        description: "Mensalidade",
        amount: 199.9,
        paymentMethod: PaymentMethod.PIX,
      });

      const originalUpdatedAt = payment.updatedAt;

      payment.transitionTo(PaymentStatus.PENDING);

      expect(payment.status).toBe(PaymentStatus.PENDING);
      expect(payment.updatedAt).toBe(originalUpdatedAt);
    });
  });

  describe("Invalid transitions", () => {
    it("should reject PAID to PENDING transition", () => {
      const payment = Payment.create({
        cpf: "12345678909",
        description: "Mensalidade",
        amount: 199.9,
        paymentMethod: PaymentMethod.PIX,
      });

      payment.transitionTo(PaymentStatus.PAID);

      expect(() => {
        payment.transitionTo(PaymentStatus.PENDING);
      }).toThrow("Invalid state transition from PAID to PENDING");
    });

    it("should reject FAIL to PENDING transition", () => {
      const payment = Payment.create({
        cpf: "12345678909",
        description: "Mensalidade",
        amount: 199.9,
        paymentMethod: PaymentMethod.PIX,
      });

      payment.transitionTo(PaymentStatus.FAIL);

      expect(() => {
        payment.transitionTo(PaymentStatus.PENDING);
      }).toThrow("Invalid state transition from FAIL to PENDING");
    });

    it("should reject PAID to FAIL transition", () => {
      const payment = Payment.create({
        cpf: "12345678909",
        description: "Mensalidade",
        amount: 199.9,
        paymentMethod: PaymentMethod.PIX,
      });

      payment.transitionTo(PaymentStatus.PAID);

      expect(() => {
        payment.transitionTo(PaymentStatus.FAIL);
      }).toThrow("Invalid state transition from PAID to FAIL");
    });

    it("should reject FAIL to PAID transition", () => {
      const payment = Payment.create({
        cpf: "12345678909",
        description: "Mensalidade",
        amount: 199.9,
        paymentMethod: PaymentMethod.PIX,
      });

      payment.transitionTo(PaymentStatus.FAIL);

      expect(() => {
        payment.transitionTo(PaymentStatus.PAID);
      }).toThrow("Invalid state transition from FAIL to PAID");
    });
  });

  describe("Domain events", () => {
    it("should emit domain event when status changes", () => {
      const payment = Payment.create({
        cpf: "12345678909",
        description: "Mensalidade",
        amount: 199.9,
        paymentMethod: PaymentMethod.PIX,
      });

      payment.transitionTo(PaymentStatus.PAID);

      const events = payment.getDomainEvents();
      expect(events).toHaveLength(1);
      expect(events[0].data.paymentId).toBe(payment.id);
      expect(events[0].data.oldStatus).toBe(PaymentStatus.PENDING);
      expect(events[0].data.newStatus).toBe(PaymentStatus.PAID);
    });

    it("should not emit domain event when status does not change", () => {
      const payment = Payment.create({
        cpf: "12345678909",
        description: "Mensalidade",
        amount: 199.9,
        paymentMethod: PaymentMethod.PIX,
      });

      payment.transitionTo(PaymentStatus.PENDING);

      const events = payment.getDomainEvents();
      expect(events).toHaveLength(0);
    });

    it("should clear domain events after retrieval", () => {
      const payment = Payment.create({
        cpf: "12345678909",
        description: "Mensalidade",
        amount: 199.9,
        paymentMethod: PaymentMethod.PIX,
      });

      payment.transitionTo(PaymentStatus.PAID);

      const events = payment.getDomainEvents();
      expect(events).toHaveLength(1);

      payment.clearDomainEvents();
      const clearedEvents = payment.getDomainEvents();
      expect(clearedEvents).toHaveLength(0);
    });
  });

  describe("UpdatedAt timestamp", () => {
    it("should update timestamp when status changes", () => {
      const payment = Payment.create({
        cpf: "12345678909",
        description: "Mensalidade",
        amount: 199.9,
        paymentMethod: PaymentMethod.PIX,
      });

      const originalUpdatedAt = payment.updatedAt;

      setTimeout(() => {
        payment.transitionTo(PaymentStatus.PAID);
        expect(payment.updatedAt.getTime()).toBeGreaterThan(
          originalUpdatedAt.getTime(),
        );
      }, 10);
    });

    it("should not update timestamp when status does not change", () => {
      const payment = Payment.create({
        cpf: "12345678909",
        description: "Mensalidade",
        amount: 199.9,
        paymentMethod: PaymentMethod.PIX,
      });

      const originalUpdatedAt = payment.updatedAt;

      payment.transitionTo(PaymentStatus.PENDING);

      expect(payment.updatedAt).toBe(originalUpdatedAt);
    });
  });
});
