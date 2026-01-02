-- Add status to schedule items (ACTIVE | ON_HOLD | DONE)
ALTER TABLE "public"."ScheduleItem" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE';
