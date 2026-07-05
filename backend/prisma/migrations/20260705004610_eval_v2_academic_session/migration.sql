-- CreateEnum
CREATE TYPE "EvaluationStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'OPEN', 'CLOSED', 'ARCHIVED');

-- AlterTable
ALTER TABLE "exams" ADD COLUMN     "academic_session_id" UUID,
ADD COLUMN     "attempts_allowed" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "author_id" UUID,
ADD COLUMN     "auto_grade" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "code" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "extra_time_minutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "group_id" TEXT,
ADD COLUMN     "level" TEXT,
ADD COLUMN     "max_score" INTEGER NOT NULL DEFAULT 100,
ADD COLUMN     "one_question_at_a_time" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "published_at" TIMESTAMP(3),
ADD COLUMN     "randomize_questions" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "show_result_immediately" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "shuffle_answers" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "status" "EvaluationStatus" NOT NULL DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "avatar_url" TEXT,
ADD COLUMN     "is_locked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "last_login_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "academic_sessions" (
    "id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "academic_year" TEXT NOT NULL,
    "start_date" TIMESTAMP(3) NOT NULL,
    "end_date" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "academic_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "exams_code_key" ON "exams"("code");

-- CreateIndex
CREATE INDEX "exams_academic_session_id_idx" ON "exams"("academic_session_id");

-- AddForeignKey
ALTER TABLE "exams" ADD CONSTRAINT "exams_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exams" ADD CONSTRAINT "exams_academic_session_id_fkey" FOREIGN KEY ("academic_session_id") REFERENCES "academic_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

