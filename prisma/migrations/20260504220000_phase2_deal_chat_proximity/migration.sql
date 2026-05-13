-- AlterEnum
ALTER TYPE "EscrowEventType" ADD VALUE 'CHAT_MESSAGE';
ALTER TYPE "EscrowEventType" ADD VALUE 'PROXIMITY_HINT';

-- CreateTable
CREATE TABLE "DealMessage" (
    "id" TEXT NOT NULL,
    "dealId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "actionKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DealMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DealMessage_dealId_createdAt_idx" ON "DealMessage"("dealId", "createdAt");

-- AddForeignKey
ALTER TABLE "DealMessage" ADD CONSTRAINT "DealMessage_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "Deal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DealMessage" ADD CONSTRAINT "DealMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
