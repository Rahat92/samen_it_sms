-- CreateTable
CREATE TABLE "MailEvent" (
    "id" SERIAL NOT NULL,
    "uuid" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "postalMsgId" INTEGER,
    "token" TEXT,
    "direction" TEXT,
    "messageId" TEXT,
    "toAddress" TEXT,
    "fromAddress" TEXT,
    "subject" TEXT,
    "status" TEXT,
    "details" TEXT,
    "output" TEXT,
    "sentWithSsl" BOOLEAN,
    "durationSec" DOUBLE PRECISION,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MailEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MailEvent_uuid_key" ON "MailEvent"("uuid");

-- CreateIndex
CREATE INDEX "MailEvent_event_idx" ON "MailEvent"("event");

-- CreateIndex
CREATE INDEX "MailEvent_toAddress_idx" ON "MailEvent"("toAddress");
