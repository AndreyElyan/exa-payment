import { Test, TestingModule } from "@nestjs/testing";
import { Logger } from "@nestjs/common";
import { TemporalClientService } from "../temporal-client";
import { Connection } from "@temporalio/client";
import { vi } from "vitest";

// Mock Temporal client
vi.mock("@temporalio/client", () => ({
  Connection: {
    connect: vi.fn(),
  },
  Client: vi.fn(),
}));

describe("TemporalClientService", () => {
  let service: TemporalClientService;
  let mockClient: any;

  beforeEach(async () => {
    const mockConnection = {
      close: vi.fn(),
    };

    mockClient = {
      workflow: {
        start: vi.fn(),
        getHandle: vi.fn(),
      },
    };

    (Connection.connect as any).mockResolvedValue(mockConnection);
    (require("@temporalio/client").Client as any).mockImplementation(
      () => mockClient,
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [TemporalClientService],
    }).compile();

    service = module.get<TemporalClientService>(TemporalClientService);
    vi.clearAllMocks();
  });

  describe("getClient", () => {
    it("should create and return client on first call", async () => {
      const client = await service.getClient();

      expect(Connection.connect).toHaveBeenCalledWith({
        address: "localhost:7233",
      });
      expect(client).toBe(mockClient);
    });

    it("should return same client on subsequent calls", async () => {
      const client1 = await service.getClient();
      const client2 = await service.getClient();

      expect(client1).toBe(client2);
      expect(Connection.connect).toHaveBeenCalledTimes(1);
    });

    it("should use environment variables for connection", async () => {
      process.env.TEMPORAL_ADDRESS = "temporal-server:7233";
      process.env.TEMPORAL_NAMESPACE = "production";

      await service.getClient();

      expect(Connection.connect).toHaveBeenCalledWith({
        address: "temporal-server:7233",
      });
    });
  });

  describe("startCreditCardPaymentWorkflow", () => {
    const mockInput = {
      paymentId: "pay_123",
      cpf: "12345678900",
      description: "Test payment",
      amount: 100.5,
      idempotencyKey: "idem_123",
    };

    it("should start credit card payment workflow successfully", async () => {
      const mockHandle = {
        workflowId: "credit-card-payment-pay_123",
        firstExecutionRunId: "run_456",
      };

      mockClient.workflow.start.mockResolvedValue(mockHandle);

      const result = await service.startCreditCardPaymentWorkflow(mockInput);

      expect(result).toEqual({
        workflowId: "credit-card-payment-pay_123",
        runId: "run_456",
      });

      expect(mockClient.workflow.start).toHaveBeenCalledWith(
        "creditCardPaymentWorkflow",
        {
          args: [mockInput],
          taskQueue: "payment-workflow",
          workflowId: "credit-card-payment-pay_123",
          workflowIdReusePolicy: "WORKFLOW_ID_REUSE_POLICY_REJECT_DUPLICATE",
        },
      );
    });

    it("should generate unique workflow ID", async () => {
      const mockHandle = {
        workflowId: "credit-card-payment-pay_123",
        firstExecutionRunId: "run_456",
      };

      mockClient.workflow.start.mockResolvedValue(mockHandle);

      await service.startCreditCardPaymentWorkflow(mockInput);

      expect(mockClient.workflow.start).toHaveBeenCalledWith(
        "creditCardPaymentWorkflow",
        expect.objectContaining({
          workflowId: "credit-card-payment-pay_123",
        }),
      );
    });

    it("should handle workflow start errors", async () => {
      const error = new Error("Workflow start failed");
      mockClient.workflow.start.mockRejectedValue(error);

      await expect(
        service.startCreditCardPaymentWorkflow(mockInput),
      ).rejects.toThrow("Workflow start failed");
    });
  });

  describe("signalPaymentStatus", () => {
    it("should signal payment status successfully", async () => {
      const mockHandle = {
        signal: jest.fn(),
      };

      mockClient.workflow.getHandle.mockReturnValue(mockHandle);

      await service.signalPaymentStatus("workflow_123", "PAID", {
        transactionId: "tx_456",
      });

      expect(mockClient.workflow.getHandle).toHaveBeenCalledWith(
        "workflow_123",
      );
      expect(mockHandle.signal).toHaveBeenCalledWith("paymentStatus", {
        status: "PAID",
        providerData: { transactionId: "tx_456" },
      });
    });

    it("should handle signal errors", async () => {
      const error = new Error("Signal failed");
      mockClient.workflow.getHandle.mockImplementation(() => {
        throw error;
      });

      await expect(
        service.signalPaymentStatus("workflow_123", "PAID"),
      ).rejects.toThrow("Signal failed");
    });
  });

  describe("getPaymentStatus", () => {
    it("should get payment status successfully", async () => {
      const mockHandle = {
        query: jest.fn().mockResolvedValue("PAID"),
      };

      mockClient.workflow.getHandle.mockReturnValue(mockHandle);

      const status = await service.getPaymentStatus("workflow_123");

      expect(status).toBe("PAID");
      expect(mockClient.workflow.getHandle).toHaveBeenCalledWith(
        "workflow_123",
      );
      expect(mockHandle.query).toHaveBeenCalledWith("getPaymentStatus");
    });

    it("should handle query errors", async () => {
      const error = new Error("Query failed");
      mockClient.workflow.getHandle.mockImplementation(() => {
        throw error;
      });

      await expect(service.getPaymentStatus("workflow_123")).rejects.toThrow(
        "Query failed",
      );
    });
  });

  describe("getWorkflowResult", () => {
    it("should get workflow result successfully", async () => {
      const mockResult = {
        status: "PAID",
        initPoint: "https://mercadopago.com/checkout/start?pref_id=mp_123",
      };

      const mockHandle = {
        result: jest.fn().mockResolvedValue(mockResult),
      };

      mockClient.workflow.getHandle.mockReturnValue(mockHandle);

      const result = await service.getWorkflowResult("workflow_123");

      expect(result).toEqual(mockResult);
      expect(mockClient.workflow.getHandle).toHaveBeenCalledWith(
        "workflow_123",
      );
      expect(mockHandle.result).toHaveBeenCalled();
    });

    it("should handle result errors", async () => {
      const error = new Error("Result failed");
      mockClient.workflow.getHandle.mockImplementation(() => {
        throw error;
      });

      await expect(service.getWorkflowResult("workflow_123")).rejects.toThrow(
        "Result failed",
      );
    });
  });

  describe("environment configuration", () => {
    it("should use default values when env vars not set", async () => {
      delete process.env.TEMPORAL_ADDRESS;
      delete process.env.TEMPORAL_NAMESPACE;

      await service.getClient();

      expect(Connection.connect).toHaveBeenCalledWith({
        address: "localhost:7233",
      });
    });

    it("should use custom namespace from env", async () => {
      process.env.TEMPORAL_NAMESPACE = "custom-namespace";

      await service.getClient();

      expect(Connection.connect).toHaveBeenCalledWith({
        address: "localhost:7233",
      });
    });
  });
});
