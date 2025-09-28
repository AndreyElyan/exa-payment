import { Worker, NativeConnection } from "@temporalio/worker";
import { Injectable, Logger, OnModuleDestroy } from "@nestjs/common";
import { PaymentActivitiesImpl } from "./payment/payment.activities";
import * as path from "path";

@Injectable()
export class TemporalWorkerService implements OnModuleDestroy {
  private readonly logger = new Logger(TemporalWorkerService.name);
  private worker?: Worker;
  private connection?: NativeConnection;
  private isStarted = false;

  constructor(private readonly paymentActivities: PaymentActivitiesImpl) {}

  async start(): Promise<void> {
    if (this.isStarted) {
      return;
    }
    try {
      this.logger.log("Starting Temporal Worker...");

      this.connection = await NativeConnection.connect({
        address: process.env.TEMPORAL_ADDRESS || "localhost:7233",
      });

      this.worker = await Worker.create({
        connection: this.connection,
        namespace: process.env.TEMPORAL_NAMESPACE || "default",
        taskQueue: "payment-workflow",
        workflowsPath: path.join(
          __dirname,
          "payment",
          "credit-card-payment.workflow.js",
        ),
        activities: {
          createPaymentRecord: this.paymentActivities.createPaymentRecord.bind(
            this.paymentActivities,
          ),
          createMercadoPagoPreference:
            this.paymentActivities.createMercadoPagoPreference.bind(
              this.paymentActivities,
            ),
          updatePaymentStatus: this.paymentActivities.updatePaymentStatus.bind(
            this.paymentActivities,
          ),
          checkPaymentStatus: this.paymentActivities.checkPaymentStatus.bind(
            this.paymentActivities,
          ),
          publishStatusChangeEvent:
            this.paymentActivities.publishStatusChangeEvent.bind(
              this.paymentActivities,
            ),
        },
      });

      this.isStarted = true;
      this.worker
        .run()
        .then(() => {
          this.logger.log("Temporal Worker stopped");
        })
        .catch((error) => {
          this.logger.error("Temporal Worker run failed", error);
        });

      this.logger.log("Temporal Worker started successfully");
    } catch (error) {
      this.logger.error("Failed to start Temporal Worker", error);
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log("Shutting down Temporal Worker...");

    if (this.worker) {
      await this.worker.shutdown();
    }

    if (this.connection) {
      await this.connection.close();
    }

    this.logger.log("Temporal Worker shut down successfully");
  }
}
