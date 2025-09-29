import {
  Controller,
  Post,
  Body,
  Headers,
  Logger,
  HttpStatus,
  HttpCode,
  BadRequestException,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiHeader } from "@nestjs/swagger";
import { TemporalClientService } from "../../infra/workflows/temporal-client";

interface MercadoPagoWebhookPayload {
  id: number;
  live_mode: boolean;
  type: string;
  date_created: string;
  data: {
    id: string;
    status: string;
    external_reference?: string;
    transaction_amount?: number;
    currency_id?: string;
    payment_method_id?: string;
    payment_type_id?: string;
    date_approved?: string;
    date_created?: string;
    date_last_updated?: string;
  };
}

@ApiTags("webhooks")
@Controller("webhook")
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(private readonly temporalClient: TemporalClientService) {}

  @Post("mercado-pago")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Webhook do Mercado Pago",
    description: "Recebe notificações de status de pagamento do Mercado Pago",
  })
  @ApiResponse({
    status: 200,
    description: "Webhook processado com sucesso",
  })
  @ApiResponse({
    status: 400,
    description: "Payload inválido",
  })
  @ApiHeader({
    name: "x-signature",
    description: "Assinatura do webhook (produção)",
    required: false,
  })
  async handleMercadoPagoWebhook(
    @Body() body: MercadoPagoWebhookPayload,
    @Headers() headers: Record<string, string>,
  ): Promise<{ status: string; message: string }> {
    this.logger.log("Received Mercado Pago webhook");
    this.logger.log("Headers:", JSON.stringify(headers, null, 2));
    this.logger.log("Body:", JSON.stringify(body, null, 2));

    try {
      if (!body || !body.type || !body.data) {
        throw new BadRequestException("Invalid webhook payload");
      }

      if (body.type !== "payment") {
        this.logger.log(`Ignoring webhook type: ${body.type}`);
        return {
          status: "ignored",
          message: `Webhook type ${body.type} ignored`,
        };
      }

      const { data } = body;
      const paymentId = data.external_reference;
      const mercadoPagoStatus = data.status;

      if (!paymentId) {
        this.logger.warn("No external_reference found in webhook");
        return {
          status: "warning",
          message: "No external_reference found",
        };
      }

      const mappedStatus = this.mapMercadoPagoStatus(mercadoPagoStatus);

      this.logger.log(
        `Processing payment ${paymentId} with status ${mercadoPagoStatus} -> ${mappedStatus}`,
      );

      const workflowId = `credit-card-payment-${paymentId}`;

      this.logger.log(
        `Signaling workflow ${workflowId} with status ${mappedStatus}`,
      );

      await this.temporalClient.signalPaymentStatus(
        workflowId,
        mappedStatus,
        body,
      );

      this.logger.log(`Workflow ${workflowId} signaled successfully`);

      return {
        status: "success",
        message: `Payment ${paymentId} status updated to ${mappedStatus}`,
      };
    } catch (error) {
      this.logger.error("Error processing webhook:", error);

      throw new BadRequestException(
        `Webhook processing failed: ${error.message}`,
      );
    }
  }

  private mapMercadoPagoStatus(mercadoPagoStatus: string): string {
    switch (mercadoPagoStatus) {
      case "approved":
        return "PAID";
      case "rejected":
      case "cancelled":
        return "FAIL";
      case "pending":
      case "in_process":
      case "in_mediation":
        return "PENDING";
      default:
        this.logger.warn(`Unknown Mercado Pago status: ${mercadoPagoStatus}`);
        return "PENDING";
    }
  }

  @Post("mercado-pago/test")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Teste de webhook",
    description: "Endpoint para testar webhooks do Mercado Pago",
  })
  @ApiResponse({
    status: 200,
    description: "Teste de webhook executado com sucesso",
  })
  async testWebhook(
    @Body() body: any,
  ): Promise<{ status: string; message: string; received: any }> {
    this.logger.log("Test webhook received");

    return {
      status: "success",
      message: "Test webhook received successfully",
      received: body,
    };
  }
}
