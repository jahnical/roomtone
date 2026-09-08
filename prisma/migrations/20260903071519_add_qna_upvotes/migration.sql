-- CreateTable
CREATE TABLE "QnaUpvote" (
    "id" TEXT NOT NULL,
    "qnaItemId" TEXT NOT NULL,
    "participantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QnaUpvote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "QnaUpvote_qnaItemId_participantId_key" ON "QnaUpvote"("qnaItemId", "participantId");

-- AddForeignKey
ALTER TABLE "QnaUpvote" ADD CONSTRAINT "QnaUpvote_qnaItemId_fkey" FOREIGN KEY ("qnaItemId") REFERENCES "QnaItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QnaUpvote" ADD CONSTRAINT "QnaUpvote_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "Participant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
