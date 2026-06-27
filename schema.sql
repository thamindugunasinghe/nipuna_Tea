-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'staff',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "nic" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "type" TEXT NOT NULL DEFAULT 'regular',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lorries" (
    "id" SERIAL NOT NULL,
    "lorry_number" TEXT NOT NULL,
    "capacity" DOUBLE PRECISION,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lorries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "drivers" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "nic" TEXT,
    "lorry_id" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "pin" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "drivers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fertilisers" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "price_per_unit" DOUBLE PRECISION NOT NULL,
    "weight_per_bag" DOUBLE PRECISION,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fertilisers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_purchases" (
    "id" SERIAL NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "item_type" TEXT NOT NULL,
    "fertiliser_id" INTEGER,
    "description" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "unit_price" DOUBLE PRECISION NOT NULL,
    "total_cost" DOUBLE PRECISION NOT NULL,
    "purchase_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "settled" BOOLEAN NOT NULL DEFAULT false,
    "monthly_payment_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credit_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tea_collections" (
    "id" SERIAL NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "driver_id" INTEGER,
    "lorry_id" INTEGER,
    "kilos_by_driver" DOUBLE PRECISION NOT NULL,
    "kilos_validated" DOUBLE PRECISION,
    "water_score" INTEGER NOT NULL DEFAULT 0,
    "collection_date" TIMESTAMP(3) NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tea_collections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lorry_validations" (
    "id" SERIAL NOT NULL,
    "lorry_id" INTEGER NOT NULL,
    "validation_date" TIMESTAMP(3) NOT NULL,
    "total_driver_kilos" DOUBLE PRECISION NOT NULL,
    "total_warehouse_kilos" DOUBLE PRECISION NOT NULL,
    "weight_loss" DOUBLE PRECISION NOT NULL,
    "collections_count" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lorry_validations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monthly_payments" (
    "id" SERIAL NOT NULL,
    "customer_id" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "total_kilos" DOUBLE PRECISION NOT NULL,
    "price_per_kilo" DOUBLE PRECISION NOT NULL,
    "gross_payment" DOUBLE PRECISION NOT NULL,
    "grocery_deduction" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fertiliser_deduction" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "other_deduction_pct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "other_deduction_amt" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "net_payment" DOUBLE PRECISION NOT NULL,
    "settled_credit_ids" JSONB,
    "paid" BOOLEAN NOT NULL DEFAULT false,
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "monthly_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "driver_commissions" (
    "id" SERIAL NOT NULL,
    "driver_id" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "total_kilos" DOUBLE PRECISION NOT NULL,
    "price_per_kilo" DOUBLE PRECISION NOT NULL,
    "commission_rate" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "commission_amount" DOUBLE PRECISION NOT NULL,
    "paid" BOOLEAN NOT NULL DEFAULT false,
    "paid_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "driver_commissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "driver_sessions" (
    "id" SERIAL NOT NULL,
    "driver_id" INTEGER NOT NULL,
    "lorry_id" INTEGER,
    "session_date" TIMESTAMP(3) NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "stopped_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "collections_count" INTEGER NOT NULL DEFAULT 0,
    "total_kilos" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "driver_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "customers_nic_key" ON "customers"("nic");

-- CreateIndex
CREATE UNIQUE INDEX "lorries_lorry_number_key" ON "lorries"("lorry_number");

-- CreateIndex
CREATE UNIQUE INDEX "drivers_nic_key" ON "drivers"("nic");

-- CreateIndex
CREATE UNIQUE INDEX "lorry_validations_lorry_id_validation_date_key" ON "lorry_validations"("lorry_id", "validation_date");

-- CreateIndex
CREATE UNIQUE INDEX "monthly_payments_customer_id_month_year_key" ON "monthly_payments"("customer_id", "month", "year");

-- CreateIndex
CREATE UNIQUE INDEX "driver_commissions_driver_id_month_year_key" ON "driver_commissions"("driver_id", "month", "year");

-- CreateIndex
CREATE UNIQUE INDEX "settings_key_key" ON "settings"("key");

-- CreateIndex
CREATE UNIQUE INDEX "driver_sessions_driver_id_session_date_key" ON "driver_sessions"("driver_id", "session_date");

-- AddForeignKey
ALTER TABLE "drivers" ADD CONSTRAINT "drivers_lorry_id_fkey" FOREIGN KEY ("lorry_id") REFERENCES "lorries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_purchases" ADD CONSTRAINT "credit_purchases_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_purchases" ADD CONSTRAINT "credit_purchases_fertiliser_id_fkey" FOREIGN KEY ("fertiliser_id") REFERENCES "fertilisers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_purchases" ADD CONSTRAINT "credit_purchases_monthly_payment_id_fkey" FOREIGN KEY ("monthly_payment_id") REFERENCES "monthly_payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tea_collections" ADD CONSTRAINT "tea_collections_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tea_collections" ADD CONSTRAINT "tea_collections_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tea_collections" ADD CONSTRAINT "tea_collections_lorry_id_fkey" FOREIGN KEY ("lorry_id") REFERENCES "lorries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lorry_validations" ADD CONSTRAINT "lorry_validations_lorry_id_fkey" FOREIGN KEY ("lorry_id") REFERENCES "lorries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monthly_payments" ADD CONSTRAINT "monthly_payments_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_commissions" ADD CONSTRAINT "driver_commissions_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_sessions" ADD CONSTRAINT "driver_sessions_driver_id_fkey" FOREIGN KEY ("driver_id") REFERENCES "drivers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "driver_sessions" ADD CONSTRAINT "driver_sessions_lorry_id_fkey" FOREIGN KEY ("lorry_id") REFERENCES "lorries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

