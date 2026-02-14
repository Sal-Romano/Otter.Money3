-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "householdId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "vin" VARCHAR(17) NOT NULL,
    "year" INTEGER NOT NULL,
    "make" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "trim" TEXT,
    "mileage" INTEGER NOT NULL,
    "zipCode" VARCHAR(10) NOT NULL,
    "purchasePrice" DECIMAL(19,4),
    "purchaseDate" DATE,
    "lastValuationAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VehicleValuation" (
    "id" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "mileageAtValuation" INTEGER NOT NULL,
    "marketValue" DECIMAL(19,4) NOT NULL,
    "msrp" DECIMAL(19,4),
    "rawResponse" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VehicleValuation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_accountId_key" ON "Vehicle"("accountId");

-- CreateIndex
CREATE INDEX "Vehicle_householdId_idx" ON "Vehicle"("householdId");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_householdId_vin_key" ON "Vehicle"("householdId", "vin");

-- CreateIndex
CREATE INDEX "VehicleValuation_vehicleId_date_idx" ON "VehicleValuation"("vehicleId", "date");

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_householdId_fkey" FOREIGN KEY ("householdId") REFERENCES "Household"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VehicleValuation" ADD CONSTRAINT "VehicleValuation_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
