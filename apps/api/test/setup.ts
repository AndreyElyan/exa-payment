import { beforeAll, afterAll } from "vitest";

// Global test setup
beforeAll(async () => {
  // Setup global test environment
  console.log("🧪 Setting up test environment...");

  // Set test environment variables
  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL =
    process.env.DATABASE_URL || "postgresql://app:app@localhost:5434/payments";
});

afterAll(async () => {
  // Cleanup global test environment
  console.log("🧹 Cleaning up test environment...");
});
