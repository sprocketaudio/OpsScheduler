-- Add organization-level default assignee colour used for unassigned item rendering.
ALTER TABLE "Organization"
ADD COLUMN "default_colour" TEXT NOT NULL DEFAULT '#2563eb';
