-- CreateTable
CREATE TABLE "public"."Schedule" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,

    CONSTRAINT "Schedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ScheduleItem" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "quoteLineId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "unit" TEXT,
    "quantity" DOUBLE PRECISION,
    "plannedStart" TIMESTAMP(3),
    "plannedEnd" TIMESTAMP(3),
    "employees" INTEGER,
    "estHours" DOUBLE PRECISION,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduleItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Schedule_projectId_idx" ON "public"."Schedule"("projectId");

-- CreateIndex
CREATE INDEX "ScheduleItem_scheduleId_idx" ON "public"."ScheduleItem"("scheduleId");

-- CreateIndex
CREATE INDEX "ScheduleItem_quoteLineId_idx" ON "public"."ScheduleItem"("quoteLineId");

-- AddForeignKey
ALTER TABLE "public"."Schedule" ADD CONSTRAINT "Schedule_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Schedule" ADD CONSTRAINT "Schedule_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ScheduleItem" ADD CONSTRAINT "ScheduleItem_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "public"."Schedule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ScheduleItem" ADD CONSTRAINT "ScheduleItem_quoteLineId_fkey" FOREIGN KEY ("quoteLineId") REFERENCES "public"."QuoteLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
