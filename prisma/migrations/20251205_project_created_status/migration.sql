-- Add new CREATED status for projects and set as default for newly created projects
ALTER TYPE "ProjectStatus" ADD VALUE IF NOT EXISTS 'CREATED';

