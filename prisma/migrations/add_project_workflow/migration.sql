-- Add assignedToId to Project model
ALTER TABLE "Project" ADD COLUMN "assignedToId" TEXT;

-- Update ProjectStatus enum
ALTER TYPE "ProjectStatus" ADD VALUE IF NOT EXISTS 'DEPOSIT_PENDING';
ALTER TYPE "ProjectStatus" ADD VALUE IF NOT EXISTS 'SCHEDULING_PENDING';
