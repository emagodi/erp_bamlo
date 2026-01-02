-- Per-project productivity settings and split
CREATE TABLE "public"."ProjectProductivitySetting" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "builderShare" DOUBLE PRECISION NOT NULL DEFAULT 0.3333,
    "excavationBuilder" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "excavationAssistant" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "brickBuilder" DOUBLE PRECISION NOT NULL DEFAULT 500,
    "brickAssistant" DOUBLE PRECISION NOT NULL DEFAULT 500,
    "plasterBuilder" DOUBLE PRECISION NOT NULL DEFAULT 16,
    "plasterAssistant" DOUBLE PRECISION NOT NULL DEFAULT 16,
    "cubicBuilder" DOUBLE PRECISION NOT NULL DEFAULT 5,
    "cubicAssistant" DOUBLE PRECISION NOT NULL DEFAULT 5,
    CONSTRAINT "ProjectProductivitySetting_pkey" PRIMARY KEY ("id")
);

-- One settings row per project
CREATE UNIQUE INDEX "ProjectProductivitySetting_projectId_key" ON "public"."ProjectProductivitySetting"("projectId");

-- FK to Project
ALTER TABLE "public"."ProjectProductivitySetting"
  ADD CONSTRAINT "ProjectProductivitySetting_projectId_fkey"
  FOREIGN KEY ("projectId") REFERENCES "public"."Project"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
