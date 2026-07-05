-- CreateTable
CREATE TABLE "certificates" (
    "id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "attempt_id" UUID NOT NULL,
    "student_name" TEXT NOT NULL,
    "student_email" TEXT NOT NULL,
    "matricule" TEXT,
    "class_name" TEXT,
    "evaluation_title" TEXT NOT NULL,
    "subject_name" TEXT,
    "note" DOUBLE PRECISION NOT NULL,
    "total_points" INTEGER NOT NULL,
    "mention" TEXT NOT NULL,
    "issued_by_id" UUID,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "certificates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "certificates_code_key" ON "certificates"("code");

-- CreateIndex
CREATE UNIQUE INDEX "certificates_attempt_id_key" ON "certificates"("attempt_id");

-- CreateIndex
CREATE INDEX "certificates_issued_by_id_idx" ON "certificates"("issued_by_id");

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_attempt_id_fkey" FOREIGN KEY ("attempt_id") REFERENCES "attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_issued_by_id_fkey" FOREIGN KEY ("issued_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

