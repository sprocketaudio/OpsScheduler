-- Add per-user UI theme preference for light/dark mode.
ALTER TABLE "User"
ADD COLUMN "ui_theme" VARCHAR(16) NOT NULL DEFAULT 'light';
