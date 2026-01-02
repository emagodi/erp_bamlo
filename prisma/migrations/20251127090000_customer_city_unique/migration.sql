-- Add city column (nullable) to customers and enforce unique (displayName, city)
ALTER TABLE "public"."Customer" ADD COLUMN "city" TEXT;

-- Unique composite index on displayName + city
CREATE UNIQUE INDEX "Customer_displayName_city_key" ON "public"."Customer"("displayName", "city");
