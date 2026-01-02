-- Track daily reports linked to schedule tasks
CREATE TABLE "public"."ScheduleTaskReport" (
    "id" TEXT NOT NULL,
    "scheduleItemId" TEXT NOT NULL,
    "reporterId" TEXT,
    "reportedForDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activity" TEXT,
    "usedQty" DOUBLE PRECISION,
    "usedUnit" TEXT,
    "remainingQty" DOUBLE PRECISION,
    "remainingUnit" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ScheduleTaskReport_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ScheduleTaskReport_scheduleItemId_idx" ON "public"."ScheduleTaskReport"("scheduleItemId");
CREATE INDEX "ScheduleTaskReport_reporterId_idx" ON "public"."ScheduleTaskReport"("reporterId");
CREATE INDEX "ScheduleTaskReport_reportedForDate_idx" ON "public"."ScheduleTaskReport"("reportedForDate");

ALTER TABLE "public"."ScheduleTaskReport"
  ADD CONSTRAINT "ScheduleTaskReport_scheduleItemId_fkey"
  FOREIGN KEY ("scheduleItemId") REFERENCES "public"."ScheduleItem"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "public"."ScheduleTaskReport"
  ADD CONSTRAINT "ScheduleTaskReport_reporterId_fkey"
  FOREIGN KEY ("reporterId") REFERENCES "public"."User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
