-- AlterTable
ALTER TABLE "User"
ADD COLUMN     "calendar_visible_start_time" VARCHAR(8) NOT NULL DEFAULT '08:00:00',
ADD COLUMN     "calendar_visible_end_time" VARCHAR(8) NOT NULL DEFAULT '20:00:00';
