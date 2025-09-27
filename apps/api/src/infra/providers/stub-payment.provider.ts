import { Injectable, Logger } from "@nestjs/common";
import {
  PaymentProvider,
  CreateCreditCardChargeInput,
  CreateCreditCardChargeOutput,
} from "../../application/ports/payment-provider.port";

export interface StubConfig {
  simulateTimeout: boolean;
  simulateError: boolean;
  errorRate: number;
  timeoutDelay: number;
  responseDelay: number;
}

@Injectable()
export class StubPaymentProvider implements PaymentProvider {
  private readonly logger = new Logger(StubPaymentProvider.name);
  private requestCount = 0;

  constructor(
    private readonly config: StubConfig = {
      simulateTimeout: false,
      simulateError: false,
      errorRate: 0.0,
      timeoutDelay: 5000,
      responseDelay: 100,
    },
  ) {}

  async createCreditCardCharge(
    input: CreateCreditCardChargeInput,
  ): Promise<CreateCreditCardChargeOutput> {
    this.requestCount++;
    const { amount, description, idempotencyKey } = input;

    this.logger.log(
      `Stub: Creating credit card charge for amount: ${amount}, attempt: ${this.requestCount}`,
    );

    await new Promise((resolve) =>
      setTimeout(resolve, this.config.responseDelay),
    );

    if (this.config.simulateTimeout) {
      this.logger.warn("Stub: Simulating timeout");
      await new Promise((resolve) =>
        setTimeout(resolve, this.config.timeoutDelay),
      );
      throw new Error("Request timeout after 5000ms");
    }

    if (this.config.simulateError || Math.random() < this.config.errorRate) {
      this.logger.warn("Stub: Simulating provider error");
      throw new Error("Provider error: invalid_cpf");
    }

    if (description.includes("INVALID_CPF")) {
      this.logger.warn("Stub: Simulating validation error for invalid CPF");
      throw new Error("Provider validation error: invalid_cpf");
    }

    if (idempotencyKey === "CONFLICT_KEY") {
      this.logger.warn("Stub: Simulating idempotency conflict");
      throw new Error("Idempotency conflict: key already exists");
    }

    const providerRef = `mp_${Date.now().toString(36).substr(-8)}_${this.requestCount}`;

    this.logger.log(
      `Stub: Payment created successfully with providerRef: ${providerRef}`,
    );

    return { providerRef };
  }

  setConfig(config: Partial<StubConfig>): void {
    Object.assign(this.config, config);
    this.logger.log(`Stub configuration updated: ${JSON.stringify(config)}`);
  }

  reset(): void {
    this.requestCount = 0;
    this.logger.log("Stub: Request counter reset");
  }
}
