-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'user');

-- AlterTable
ALTER TABLE "User" DROP COLUMN "createdAt",
DROP COLUMN "image",
DROP COLUMN "updatedAt",
ADD COLUMN     "colour" TEXT NOT NULL,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "organization_id" TEXT NOT NULL,
ADD COLUMN     "profile_image_url" TEXT,
ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'user',
ADD COLUMN     "timezone" TEXT,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "name" SET NOT NULL,
ALTER COLUMN "email" SET NOT NULL;

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkItem" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "customer" TEXT,
    "notes" TEXT,
    "assignee_id" TEXT,
    "organization_id" TEXT NOT NULL,
    "target_week" DATE NOT NULL,
    "start_date" DATE,
    "end_date" DATE,
    "start_time" TIME(6),
    "end_time" TIME(6),
    "fixed" BOOLEAN NOT NULL DEFAULT false,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "created_by" TEXT NOT NULL,
    "updated_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkItem_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "WorkItem_start_time_requires_start_date" CHECK ("start_time" IS NULL OR "start_date" IS NOT NULL),
    CONSTRAINT "WorkItem_end_time_requires_start_time" CHECK ("end_time" IS NULL OR "start_time" IS NOT NULL)
);

-- CreateIndex
CREATE UNIQUE INDEX "Organization_name_key" ON "Organization"("name");

-- CreateIndex
CREATE INDEX "WorkItem_organization_id_idx" ON "WorkItem"("organization_id");

-- CreateIndex
CREATE INDEX "WorkItem_target_week_idx" ON "WorkItem"("target_week");

-- CreateIndex
CREATE INDEX "WorkItem_start_date_idx" ON "WorkItem"("start_date");

-- CreateIndex
CREATE INDEX "WorkItem_assignee_id_idx" ON "WorkItem"("assignee_id");

-- CreateIndex
CREATE INDEX "WorkItem_done_idx" ON "WorkItem"("done");

-- CreateIndex
CREATE INDEX "WorkItem_fixed_idx" ON "WorkItem"("fixed");

-- CreateIndex
CREATE UNIQUE INDEX "User_colour_key" ON "User"("colour");

-- CreateIndex
CREATE INDEX "User_organization_id_idx" ON "User"("organization_id");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_assignee_id_fkey" FOREIGN KEY ("assignee_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkItem" ADD CONSTRAINT "WorkItem_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
