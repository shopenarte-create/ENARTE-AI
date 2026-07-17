-- CreateTable
CREATE TABLE IF NOT EXISTS "assistant_taught_answer" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "locale" TEXT NOT NULL DEFAULT 'ar',
    "question" TEXT NOT NULL,
    "questionNorm" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'approved',
    "conversationId" TEXT,
    "sourceMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assistant_taught_answer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "assistant_taught_answer_shop_questionNorm_key" ON "assistant_taught_answer"("shop", "questionNorm");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "assistant_taught_answer_shop_locale_status_idx" ON "assistant_taught_answer"("shop", "locale", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "assistant_taught_answer_shop_updatedAt_idx" ON "assistant_taught_answer"("shop", "updatedAt");
