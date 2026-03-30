-- Add per-user date locale preference for UI date formatting.
ALTER TABLE "User"
ADD COLUMN "date_locale" VARCHAR(10) NOT NULL DEFAULT 'en-GB';

