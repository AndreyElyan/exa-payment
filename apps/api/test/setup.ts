import { beforeAll, afterAll } from "vitest";

beforeAll(async () => {
  console.log("🧪 Setting up test environment...");

  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL =
    process.env.DATABASE_URL || "postgresql://app:app@localhost:5434/payments";
});

afterAll(async () => {
  console.log("🧹 Cleaning up test environment...");
});
