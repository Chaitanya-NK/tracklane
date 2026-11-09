-- CreateEnum
CREATE TYPE "SlaMetric" AS ENUM ('first_response', 'resolution');

-- AlterTable
ALTER TABLE "issues" ADD COLUMN     "time_estimate" INTEGER;

-- CreateTable
CREATE TABLE "project_snapshots" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status_counts" JSONB NOT NULL,
    "todo_count" INTEGER NOT NULL DEFAULT 0,
    "in_progress_count" INTEGER NOT NULL DEFAULT 0,
    "done_count" INTEGER NOT NULL DEFAULT 0,
    "sprint_id" TEXT,
    "sprint_scope" INTEGER NOT NULL DEFAULT 0,
    "sprint_remaining" INTEGER NOT NULL DEFAULT 0,
    "sprint_issues" INTEGER NOT NULL DEFAULT 0,
    "sprint_open_issues" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "worklogs" (
    "id" TEXT NOT NULL,
    "issue_id" TEXT NOT NULL,
    "user_id" TEXT,
    "minutes" INTEGER NOT NULL,
    "date" DATE NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "worklogs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sla_policies" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "query" TEXT NOT NULL,
    "metric" "SlaMetric" NOT NULL,
    "target_minutes" INTEGER NOT NULL,
    "warn_minutes" INTEGER NOT NULL DEFAULT 60,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sla_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sla_notices" (
    "policy_id" TEXT NOT NULL,
    "issue_id" TEXT NOT NULL,
    "kind" "NotificationType" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sla_notices_pkey" PRIMARY KEY ("policy_id","issue_id","kind")
);

-- CreateTable
CREATE TABLE "dashboards" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "owner_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "shared" BOOLEAN NOT NULL DEFAULT false,
    "widgets" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dashboards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "project_snapshots_sprint_id_date_idx" ON "project_snapshots"("sprint_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "project_snapshots_project_id_date_key" ON "project_snapshots"("project_id", "date");

-- CreateIndex
CREATE INDEX "worklogs_issue_id_date_idx" ON "worklogs"("issue_id", "date");

-- CreateIndex
CREATE INDEX "worklogs_user_id_date_idx" ON "worklogs"("user_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "sla_policies_project_id_name_key" ON "sla_policies"("project_id", "name");

-- CreateIndex
CREATE INDEX "dashboards_workspace_id_owner_id_idx" ON "dashboards"("workspace_id", "owner_id");

-- AddForeignKey
ALTER TABLE "project_snapshots" ADD CONSTRAINT "project_snapshots_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_snapshots" ADD CONSTRAINT "project_snapshots_sprint_id_fkey" FOREIGN KEY ("sprint_id") REFERENCES "sprints"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "worklogs" ADD CONSTRAINT "worklogs_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "worklogs" ADD CONSTRAINT "worklogs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla_policies" ADD CONSTRAINT "sla_policies_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla_notices" ADD CONSTRAINT "sla_notices_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "sla_policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla_notices" ADD CONSTRAINT "sla_notices_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboards" ADD CONSTRAINT "dashboards_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dashboards" ADD CONSTRAINT "dashboards_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
