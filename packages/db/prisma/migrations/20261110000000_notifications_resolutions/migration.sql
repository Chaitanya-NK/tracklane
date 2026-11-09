-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('assigned', 'mentioned', 'commented', 'status_changed', 'approval_requested', 'approval_decided', 'sla_at_risk', 'sla_breached');

-- CreateEnum
CREATE TYPE "NotificationDelivery" AS ENUM ('pending', 'sent', 'skipped', 'failed');

-- AlterTable
ALTER TABLE "issues" ADD COLUMN     "resolution_id" TEXT;

-- CreateTable
CREATE TABLE "resolutions" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "position" INTEGER NOT NULL DEFAULT 0,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "resolutions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "issue_id" TEXT,
    "actor_id" TEXT,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "url" TEXT NOT NULL,
    "read_at" TIMESTAMP(3),
    "email_state" "NotificationDelivery" NOT NULL DEFAULT 'skipped',
    "push_state" "NotificationDelivery" NOT NULL DEFAULT 'skipped',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issue_watchers" (
    "issue_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "issue_watchers_pkey" PRIMARY KEY ("issue_id","user_id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "user_id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "in_app" BOOLEAN NOT NULL DEFAULT true,
    "email" BOOLEAN NOT NULL DEFAULT false,
    "push" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("user_id","type")
);

-- CreateTable
CREATE TABLE "push_subscriptions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "user_agent" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_used_at" TIMESTAMP(3),

    CONSTRAINT "push_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "issues_resolution_id_idx" ON "issues"("resolution_id");

-- CreateIndex
CREATE INDEX "resolutions_workspace_id_position_idx" ON "resolutions"("workspace_id", "position");

-- CreateIndex
CREATE UNIQUE INDEX "resolutions_workspace_id_name_key" ON "resolutions"("workspace_id", "name");

-- CreateIndex
CREATE INDEX "notifications_user_id_workspace_id_read_at_created_at_idx" ON "notifications"("user_id", "workspace_id", "read_at", "created_at");

-- CreateIndex
CREATE INDEX "notifications_email_state_created_at_idx" ON "notifications"("email_state", "created_at");

-- CreateIndex
CREATE INDEX "notifications_push_state_created_at_idx" ON "notifications"("push_state", "created_at");

-- CreateIndex
CREATE INDEX "issue_watchers_user_id_idx" ON "issue_watchers"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "push_subscriptions_endpoint_key" ON "push_subscriptions"("endpoint");

-- CreateIndex
CREATE INDEX "push_subscriptions_user_id_idx" ON "push_subscriptions"("user_id");

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_resolution_id_fkey" FOREIGN KEY ("resolution_id") REFERENCES "resolutions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resolutions" ADD CONSTRAINT "resolutions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_watchers" ADD CONSTRAINT "issue_watchers_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_watchers" ADD CONSTRAINT "issue_watchers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "push_subscriptions" ADD CONSTRAINT "push_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Data: every existing workspace gets the default resolutions, and issues already in a Done
-- status are marked with the default one ("Done").
INSERT INTO "resolutions" ("id", "workspace_id", "name", "description", "position", "is_default", "updated_at")
SELECT 'res_' || md5(w."id" || d."name"), w."id", d."name", d."description", d."position", d."is_default", CURRENT_TIMESTAMP
FROM "workspaces" w
CROSS JOIN (VALUES
    ('Done', 'The work is complete', 0, true),
    ('Fixed', 'A fix has been made', 1, false),
    ('Won''t fix', 'It won''t be addressed', 2, false),
    ('Duplicate', 'Covered by another issue', 3, false),
    ('Cannot reproduce', 'The problem couldn''t be reproduced', 4, false),
    ('Works as designed', 'Behaving as intended', 5, false)
) AS d("name", "description", "position", "is_default");

UPDATE "issues" i
SET "resolution_id" = r."id"
FROM "workflow_statuses" s, "resolutions" r
WHERE s."id" = i."status_id" AND s."category" = 'done'
  AND r."workspace_id" = i."workspace_id" AND r."is_default" = true;
