-- Enforce one schedule per project
CREATE UNIQUE INDEX "Schedule_projectId_key" ON "public"."Schedule"("projectId");
