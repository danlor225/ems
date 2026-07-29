-- CreateEnum
CREATE TYPE "CourseAccessSource" AS ENUM ('MANUAL', 'PAYMENT');

-- AlterTable
ALTER TABLE "courses" ADD COLUMN     "is_paid" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "price" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "course_access" (
    "id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "source" "CourseAccessSource" NOT NULL DEFAULT 'MANUAL',
    "granted_by_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_attendance" (
    "id" UUID NOT NULL,
    "course_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "marked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_attendance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "course_access_course_id_idx" ON "course_access"("course_id");

-- CreateIndex
CREATE INDEX "course_access_student_id_idx" ON "course_access"("student_id");

-- CreateIndex
CREATE UNIQUE INDEX "course_access_course_id_student_id_key" ON "course_access"("course_id", "student_id");

-- CreateIndex
CREATE INDEX "course_attendance_course_id_idx" ON "course_attendance"("course_id");

-- CreateIndex
CREATE UNIQUE INDEX "course_attendance_course_id_student_id_key" ON "course_attendance"("course_id", "student_id");

-- AddForeignKey
ALTER TABLE "course_access" ADD CONSTRAINT "course_access_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_access" ADD CONSTRAINT "course_access_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_access" ADD CONSTRAINT "course_access_granted_by_id_fkey" FOREIGN KEY ("granted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_attendance" ADD CONSTRAINT "course_attendance_course_id_fkey" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_attendance" ADD CONSTRAINT "course_attendance_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
