import { Injectable, Logger } from "@nestjs/common";
import {
  PaymentProvider,
  CreateCreditCardChargeInput,
  CreateCreditCardChargeOutput,
} from "../../application/ports/payment-provider.port";

export interface MercadoPagoConfig {
  accessToken: string;
  baseUrl: string;
  timeout: number;
  maxRetries: number;
}

export interface MercadoPagoPreferenceRequest {
  items: Array<{
    id: string;
    title: string;
    description: string;
    quantity: number;
    currency_id: string;
    unit_price: number;
  }>;
  payer: {
    name?: string;
    surname?: string;
    email?: string;
    phone?: {
      area_code: string;
      number: string;
    };
    identification: {
      type: string;
      number: string;
    };
    address?: {
      zip_code: string;
      street_name: string;
      street_number: number;
    };
    date_created?: string;
  };
  payment_methods?: {
    excluded_payment_methods?: Array<{ id: string }>;
    excluded_payment_types?: Array<{ id: string }>;
    default_payment_method_id?: string;
    installments?: number;
    default_installments?: number;
  };
  back_urls?: {
    success: string;
    pending: string;
    failure: string;
  };
  notification_url?: string;
  additional_info?: string;
  auto_return?: string;
  external_reference?: string;
  expires?: boolean;
  expiration_date_from?: string;
  expiration_date_to?: string;
  marketplace?: string;
  marketplace_fee?: number;
  differential_pricing?: {
    id: number;
  };
  tracks?: Array<{
    type: string;
    values: Record<string, any>;
  }>;
  metadata?: Record<string, any>;
}

export interface MercadoPagoPreferenceResponse {
  collector_id: number;
  items: Array<{
    title: string;
    description: string;
    currency_id: string;
    quantity: number;
    unit_price: number;
  }>;
  payer: {
    phone: Record<string, any>;
    identification: Record<string, any>;
    address: Record<string, any>;
  };
  back_urls: {
    success: string;
    pending: string;
    failure: string;
  };
  auto_return: string;
  payment_methods: {
    excluded_payment_methods: Array<Record<string, any>>;
    excluded_payment_types: Array<Record<string, any>>;
  };
  client_id: string;
  marketplace: string;
  marketplace_fee: number;
  shipments: {
    receiver_address: Record<string, any>;
  };
  notification_url: string;
  statement_descriptor: string;
  expiration_date_from: string;
  expiration_date_to: string;
  date_created: string;
  id: string;
  init_point: string;
  sandbox_init_point: string;
  metadata: Record<string, any>;
}

@Injectable()
export class MercadoPagoProvider implements PaymentProvider {
  private readonly logger = new Logger(MercadoPagoProvider.name);

  constructor(private readonly config: MercadoPagoConfig) {}

  async createCreditCardCharge(
    input: CreateCreditCardChargeInput,
  ): Promise<CreateCreditCardChargeOutput> {
    const { amount, description, idempotencyKey, cpf } = input;

    this.logger.log(`Creating Mercado Pago preference for amount: ${amount}`);

    const requestPayload: MercadoPagoPreferenceRequest = {
      items: [
        {
          id: `payment-${Date.now()}`,
          title: description,
          description: description,
          quantity: 1,
          currency_id: "BRL",
          unit_price: amount,
        },
      ],
      payer: {
        identification: {
          type: "CPF",
          number: cpf || "00000000000",
        },
      },
      payment_methods: {
        excluded_payment_types: [{ id: "ticket" }],
        installments: 12,
        default_installments: 1,
      },

      external_reference: idempotencyKey,
      expires: false,
    };

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        this.logger.log(
          `Attempt ${attempt}/${this.config.maxRetries} to create preference`,
        );

        const response = await this.makeRequest(requestPayload, idempotencyKey);

        this.logger.log(
          `Preference created successfully with id: ${response.id}`,
        );

        return { providerRef: response.id };
      } catch (error) {
        lastError = error as Error;
        this.logger.warn(`Attempt ${attempt} failed: ${error.message}`);

        if (attempt < this.config.maxRetries) {
          const backoffDelay = Math.pow(2, attempt - 1) * 1000;
          this.logger.log(`Retrying in ${backoffDelay}ms...`);
          await new Promise((resolve) => setTimeout(resolve, backoffDelay));
        }
      }
    }

    this.logger.error(`All ${this.config.maxRetries} attempts failed`);
    throw new Error(
      `Failed to create preference after ${this.config.maxRetries} attempts: ${lastError?.message}`,
    );
  }

  private async makeRequest(
    payload: MercadoPagoPreferenceRequest,
    idempotencyKey: string,
  ): Promise<MercadoPagoPreferenceResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(
        `${this.config.baseUrl}/checkout/preferences`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.config.accessToken}`,
            "X-Idempotency-Key": idempotencyKey,
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        },
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorBody = await response.text();
        this.logger.error(
          `Mercado Pago API error: HTTP ${response.status} - ${errorBody}`,
        );
        throw new Error(`HTTP ${response.status}: ${errorBody}`);
      }

      const data = await response.json();
      this.logger.log(`Mercado Pago preference created: ${data.id}`);
      return data as MercadoPagoPreferenceResponse;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error.name === "AbortError") {
        throw new Error(`Request timeout after ${this.config.timeout}ms`);
      }

      throw error;
    }
  }
}
