-- CreateTable
CREATE TABLE "public"."Employee" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "givenName" TEXT NOT NULL,
    "surname" TEXT,
    "ecNumber" TEXT,
    "role" TEXT NOT NULL,
    "office" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Employee_userId_key" ON "public"."Employee"("userId");
CREATE UNIQUE INDEX "Employee_ecNumber_key" ON "public"."Employee"("ecNumber");
CREATE UNIQUE INDEX "Employee_email_key" ON "public"."Employee"("email");

-- AddForeignKey
ALTER TABLE "public"."Employee" ADD CONSTRAINT "Employee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Link schedule items to employees (many-to-many)
CREATE TABLE "public"."_ScheduleItemAssignees" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL
);

-- Ensure each pairing is unique
CREATE UNIQUE INDEX "_ScheduleItemAssignees_AB_unique" ON "public"."_ScheduleItemAssignees"("A", "B");
-- Fast lookup by employee
CREATE INDEX "_ScheduleItemAssignees_B_index" ON "public"."_ScheduleItemAssignees"("B");

-- FKs
ALTER TABLE "public"."_ScheduleItemAssignees"
  ADD CONSTRAINT "_ScheduleItemAssignees_A_fkey"
  FOREIGN KEY ("A") REFERENCES "public"."ScheduleItem"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."_ScheduleItemAssignees"
  ADD CONSTRAINT "_ScheduleItemAssignees_B_fkey"
  FOREIGN KEY ("B") REFERENCES "public"."Employee"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
