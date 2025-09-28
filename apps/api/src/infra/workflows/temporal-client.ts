import { Injectable, Logger } from "@nestjs/common";
import { Client, Connection, WorkflowIdReusePolicy } from "@temporalio/client";
import { CreditCardPaymentInput } from "./payment/credit-card-payment.workflow";
import { CustomTracingService } from "../observability/tracing.service";

@Injectable()
export class TemporalClientService {
  private readonly logger = new Logger(TemporalClientService.name);
  private client?: Client;

  constructor(private readonly tracingService: CustomTracingService) {}

  async getClient(): Promise<Client> {
    if (!this.client) {
      const connection = await Connection.connect({
        address: process.env.TEMPORAL_ADDRESS || "localhost:7233",
      });

      this.client = new Client({
        connection,
        namespace: process.env.TEMPORAL_NAMESPACE || "default",
      });
    }

    return this.client;
  }

  async startCreditCardPaymentWorkflow(input: {
    paymentId: string;
    cpf: string;
    description: string;
    amount: number;
    idempotencyKey: string;
  }): Promise<{ workflowId: string; runId: string }> {
    return this.tracingService.traceWorkflow(
      "CreditCardPayment",
      "startWorkflow",
      async () => this.startCreditCardPaymentWorkflowInternal(input),
      {
        "payment.id": input.paymentId,
        "payment.amount": input.amount,
        "payment.method": "CREDIT_CARD",
      },
    );
  }

  private async startCreditCardPaymentWorkflowInternal(input: {
    paymentId: string;
    cpf: string;
    description: string;
    amount: number;
    idempotencyKey: string;
  }): Promise<{ workflowId: string; runId: string }> {
    this.logger.log(
      `Starting credit card payment workflow for payment: ${input.paymentId}`,
    );

    const client = await this.getClient();
    const workflowId = `credit-card-payment-${input.paymentId}`;

    const handle = await client.workflow.start("creditCardPaymentWorkflow", {
      args: [input as CreditCardPaymentInput],
      taskQueue: "payment-workflow",
      workflowId,
      workflowIdReusePolicy: WorkflowIdReusePolicy.REJECT_DUPLICATE,
    });

    this.logger.log(`Credit card payment workflow started: ${workflowId}`);

    return {
      workflowId: handle.workflowId,
      runId: handle.firstExecutionRunId,
    };
  }

  async signalPaymentStatus(
    workflowId: string,
    status: "PAID" | "FAIL" | string,
    providerData?: any,
  ): Promise<void> {
    this.logger.log(`Signaling payment status: ${workflowId} -> ${status}`);

    const client = await this.getClient();
    const handle = client.workflow.getHandle(workflowId);

    await handle.signal("paymentStatus", {
      status,
      providerData,
    });

    this.logger.log(`Payment status signaled: ${workflowId} -> ${status}`);
  }

  async getPaymentStatus(workflowId: string): Promise<string> {
    this.logger.log(`Getting payment status for workflow: ${workflowId}`);

    const client = await this.getClient();
    const handle = client.workflow.getHandle(workflowId);

    const status = await handle.query("getPaymentStatus");
    this.logger.log(`Payment status retrieved: ${workflowId} -> ${status}`);

    return status as string;
  }

  async getWorkflowResult(
    workflowId: string,
  ): Promise<{ status: string; initPoint?: string }> {
    this.logger.log(`Getting workflow result for: ${workflowId}`);

    const client = await this.getClient();
    const handle = client.workflow.getHandle(workflowId);

    const result = await handle.result();
    this.logger.log(`Workflow result retrieved: ${workflowId}`);

    return result;
  }
}
