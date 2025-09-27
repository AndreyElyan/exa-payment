import { Injectable } from "@nestjs/common";

export interface PaymentProviderConfig {
  mercadoPago: {
    accessToken: string;
    baseUrl: string;
    timeout: number;
    maxRetries: number;
  };
  stub: {
    simulateTimeout: boolean;
    simulateError: boolean;
    errorRate: number;
    timeoutDelay: number;
    responseDelay: number;
  };
}

@Injectable()
export class PaymentProviderConfigService {
  private config: PaymentProviderConfig;

  constructor() {
    this.config = {
      mercadoPago: {
        accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN || "APP",
        baseUrl:
          process.env.MERCADO_PAGO_BASE_URL || "https://api.mercadopago.com",
        timeout: parseInt(process.env.MERCADO_PAGO_TIMEOUT || "3000"),
        maxRetries: parseInt(process.env.MERCADO_PAGO_MAX_RETRIES || "3"),
      },
      stub: {
        simulateTimeout: process.env.STUB_SIMULATE_TIMEOUT === "true",
        simulateError: process.env.STUB_SIMULATE_ERROR === "true",
        errorRate: parseFloat(process.env.STUB_ERROR_RATE || "0.0"),
        timeoutDelay: parseInt(process.env.STUB_TIMEOUT_DELAY || "5000"),
        responseDelay: parseInt(process.env.STUB_RESPONSE_DELAY || "100"),
      },
    };
  }

  getMercadoPagoConfig() {
    return this.config.mercadoPago;
  }

  getStubConfig() {
    return this.config.stub;
  }

  updateStubConfig(updates: Partial<PaymentProviderConfig["stub"]>) {
    this.config.stub = { ...this.config.stub, ...updates };
  }
}
