-- AlterTable
ALTER TABLE "courses" ADD COLUMN     "group_id" UUID;

-- CreateIndex
CREATE INDEX "courses_group_id_idx" ON "courses"("group_id");

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
