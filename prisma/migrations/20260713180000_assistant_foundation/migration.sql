-- CreateTable
CREATE TABLE IF NOT EXISTS "assistant_conversation" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'api',
    "locale" TEXT NOT NULL DEFAULT 'ar',
    "status" TEXT NOT NULL DEFAULT 'active',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assistant_conversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "assistant_message" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL DEFAULT '',
    "workflowId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assistant_message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "assistant_event" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "conversationId" TEXT,
    "type" TEXT NOT NULL,
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "assistant_event_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "assistant_conversation_shop_status_idx" ON "assistant_conversation"("shop", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "assistant_conversation_shop_createdAt_idx" ON "assistant_conversation"("shop", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "assistant_message_conversationId_createdAt_idx" ON "assistant_message"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "assistant_event_shop_type_createdAt_idx" ON "assistant_event"("shop", "type", "createdAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "assistant_event_conversationId_createdAt_idx" ON "assistant_event"("conversationId", "createdAt");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "assistant_message" ADD CONSTRAINT "assistant_message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "assistant_conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "assistant_event" ADD CONSTRAINT "assistant_event_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "assistant_conversation"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
