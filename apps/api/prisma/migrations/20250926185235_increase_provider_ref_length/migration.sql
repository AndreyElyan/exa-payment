/*
  Warnings:

  - You are about to alter the column `providerRef` on the `payments` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(255)`.

*/
-- AlterTable
ALTER TABLE "payments" ALTER COLUMN "providerRef" SET DATA TYPE VARCHAR(255);
