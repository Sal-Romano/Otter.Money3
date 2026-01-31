-- CreateEnum
CREATE TYPE "RecurringFrequency" AS ENUM ('WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL');

-- CreateEnum
CREATE TYPE "RecurringStatus" AS ENUM ('DETECTED', 'CONFIRMED', 'DISMISSED', 'ENDED');

-- CreateTable
CREATE TABLE "RecurringTransaction" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "merchantName" TEXT NOT NULL,
    "description" TEXT,
    "frequency" "RecurringFrequency" NOT NULL,
    "expectedAmount" DECIMAL(19,4) NOT NULL,
    "amountVariance" DECIMAL(5,2) NOT NULL DEFAULT 5.00,
    "dayOfMonth" INTEGER,
    "dayOfWeek" INTEGER,
    "nextExpectedDate" DATE NOT NULL,
    "lastOccurrence" DATE,
    "accountId" TEXT,
    "categoryId" TEXT,
    "status" "RecurringStatus" NOT NULL DEFAULT 'DETECTED',
    "isManual" BOOLEAN NOT NULL DEFAULT false,
    "isPaused" BOOLEAN NOT NULL DEFAULT false,
    "occurrenceCount" INTEGER NOT NULL DEFAULT 0,
    "confidence" DECIMAL(3,2) NOT NULL DEFAULT 0.00,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecurringTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransactionRecurringLink" (
    "id" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "recurringTransactionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TransactionRecurringLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RecurringTransaction_householdId_idx" ON "RecurringTransaction"("householdId");

-- CreateIndex
CREATE INDEX "RecurringTransaction_nextExpectedDate_idx" ON "RecurringTransaction"("nextExpectedDate");

-- CreateIndex
CREATE INDEX "RecurringTransaction_status_idx" ON "RecurringTransaction"("status");

-- CreateIndex
CREATE UNIQUE INDEX "RecurringTransaction_householdId_merchantName_frequency_key" ON "RecurringTransaction"("householdId", "merchantName", "frequency");

-- CreateIndex
CREATE UNIQUE INDEX "TransactionRecurringLink_transactionId_key" ON "TransactionRecurringLink"("transactionId");

-- CreateIndex
CREATE INDEX "TransactionRecurringLink_recurringTransactionId_idx" ON "TransactionRecurringLink"("recurringTransactionId");

-- AddForeignKey
ALTER TABLE "RecurringTransaction" ADD CONSTRAINT "RecurringTransaction_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringTransaction" ADD CONSTRAINT "RecurringTransaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecurringTransaction" ADD CONSTRAINT "RecurringTransaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionRecurringLink" ADD CONSTRAINT "TransactionRecurringLink_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionRecurringLink" ADD CONSTRAINT "TransactionRecurringLink_recurringTransactionId_fkey" FOREIGN KEY ("recurringTransactionId") REFERENCES "RecurringTransaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
