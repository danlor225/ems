-- AlterEnum
ALTER TYPE "QuestionType" ADD VALUE 'SHORT_ANSWER';

-- AlterTable
ALTER TABLE "attempt_answers" ADD COLUMN     "text_answer" TEXT;

