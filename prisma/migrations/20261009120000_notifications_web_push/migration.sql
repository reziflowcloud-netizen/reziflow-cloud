-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "deepLink" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "inApp" BOOLEAN NOT NULL DEFAULT true,
    "pushRequested" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "scope" TEXT NOT NULL DEFAULT 'mine',
    "events" JSONB NOT NULL DEFAULT '{}',
    "pushEnabled" BOOLEAN NOT NULL DEFAULT false,
    "showClientName" BOOLEAN NOT NULL DEFAULT false,
    "language" TEXT NOT NULL DEFAULT 'uk',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "endpointHash" TEXT NOT NULL,
    "encryptedSubscription" TEXT NOT NULL,
    "deviceLabel" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "disabledAt" TIMESTAMP(3),
    "lastFailureAt" TIMESTAMP(3),

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPushDelivery" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "notificationId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leaseToken" TEXT,
    "leaseUntil" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "terminalAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationPushDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_organizationId_userId_inApp_readAt_createdAt_idx" ON "Notification"("organizationId", "userId", "inApp", "readAt", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_organizationId_userId_dedupeKey_key" ON "Notification"("organizationId", "userId", "dedupeKey");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_id_userId_organizationId_key" ON "Notification"("id", "userId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_userId_organizationId_key" ON "NotificationPreference"("userId", "organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpointHash_key" ON "PushSubscription"("endpointHash");

-- CreateIndex
CREATE INDEX "PushSubscription_organizationId_userId_disabledAt_idx" ON "PushSubscription"("organizationId", "userId", "disabledAt");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_id_userId_organizationId_key" ON "PushSubscription"("id", "userId", "organizationId");

-- CreateIndex
CREATE INDEX "NotificationPushDelivery_nextAttemptAt_deliveredAt_terminal_idx" ON "NotificationPushDelivery"("nextAttemptAt", "deliveredAt", "terminalAt", "leaseUntil");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPushDelivery_notificationId_subscriptionId_key" ON "NotificationPushDelivery"("notificationId", "subscriptionId");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_organizationId_fkey" FOREIGN KEY ("userId", "organizationId") REFERENCES "User"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_organizationId_fkey" FOREIGN KEY ("userId", "organizationId") REFERENCES "User"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_organizationId_fkey" FOREIGN KEY ("userId", "organizationId") REFERENCES "User"("id", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPushDelivery" ADD CONSTRAINT "NotificationPushDelivery_notificationId_userId_organizatio_fkey" FOREIGN KEY ("notificationId", "userId", "organizationId") REFERENCES "Notification"("id", "userId", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPushDelivery" ADD CONSTRAINT "NotificationPushDelivery_subscriptionId_userId_organizatio_fkey" FOREIGN KEY ("subscriptionId", "userId", "organizationId") REFERENCES "PushSubscription"("id", "userId", "organizationId") ON DELETE CASCADE ON UPDATE CASCADE;
