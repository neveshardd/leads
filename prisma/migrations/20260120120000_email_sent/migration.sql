-- CreateTable
CREATE TABLE "EmailSent" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "toAddress" TEXT NOT NULL,
    "resendMessageId" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailSent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailSent_leadId_idx" ON "EmailSent"("leadId");

-- AddForeignKey
ALTER TABLE "EmailSent" ADD CONSTRAINT "EmailSent_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
