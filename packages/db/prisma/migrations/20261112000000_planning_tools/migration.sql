-- CreateEnum
CREATE TYPE "ReleaseStatus" AS ENUM ('unreleased', 'released', 'archived');

-- CreateEnum
CREATE TYPE "GoalStatus" AS ENUM ('on_track', 'at_risk', 'off_track', 'done');

-- CreateEnum
CREATE TYPE "IssueLinkType" AS ENUM ('blocks', 'relates', 'duplicates', 'clones');

-- CreateEnum
CREATE TYPE "AutomationTrigger" AS ENUM ('issue_created', 'status_changed', 'assignee_changed', 'priority_changed', 'comment_added', 'scheduled_daily');

-- CreateEnum
CREATE TYPE "AutomationRunStatus" AS ENUM ('success', 'skipped', 'failed');

-- CreateEnum
CREATE TYPE "RecurrenceFrequency" AS ENUM ('daily', 'weekly', 'monthly');

-- AlterTable
ALTER TABLE "issues" ADD COLUMN     "custom_type_id" TEXT,
ADD COLUMN     "release_id" TEXT;

-- CreateTable
CREATE TABLE "releases" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "status" "ReleaseStatus" NOT NULL DEFAULT 'unreleased',
    "start_date" DATE,
    "release_date" DATE,
    "released_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "releases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goals" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "owner_id" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "status" "GoalStatus" NOT NULL DEFAULT 'on_track',
    "target_date" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "goals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "goal_issues" (
    "goal_id" TEXT NOT NULL,
    "issue_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "goal_issues_pkey" PRIMARY KEY ("goal_id","issue_id")
);

-- CreateTable
CREATE TABLE "issue_links" (
    "id" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "type" "IssueLinkType" NOT NULL,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "issue_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_rules" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "trigger" "AutomationTrigger" NOT NULL,
    "to_status_id" TEXT,
    "condition" TEXT NOT NULL DEFAULT '',
    "actions" JSONB NOT NULL,
    "created_by_id" TEXT,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "automation_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "automation_runs" (
    "id" TEXT NOT NULL,
    "rule_id" TEXT NOT NULL,
    "issue_id" TEXT,
    "status" "AutomationRunStatus" NOT NULL,
    "message" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "automation_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_issues" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "type" "IssueType" NOT NULL DEFAULT 'task',
    "priority" "Priority" NOT NULL DEFAULT 'medium',
    "assignee_id" TEXT,
    "frequency" "RecurrenceFrequency" NOT NULL,
    "days" INTEGER[],
    "due_in_days" INTEGER,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "next_run_at" TIMESTAMP(3) NOT NULL,
    "last_run_at" TIMESTAMP(3),
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recurring_issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "project_issue_types" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "base_type" "IssueType" NOT NULL,
    "color" TEXT NOT NULL DEFAULT 'gray',
    "icon" TEXT NOT NULL DEFAULT 'square',
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_issue_types_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "issues_release_id_idx" ON "issues"("release_id");

-- CreateIndex
CREATE UNIQUE INDEX "releases_project_id_name_key" ON "releases"("project_id", "name");

-- CreateIndex
CREATE INDEX "goals_workspace_id_idx" ON "goals"("workspace_id");

-- CreateIndex
CREATE INDEX "goal_issues_issue_id_idx" ON "goal_issues"("issue_id");

-- CreateIndex
CREATE INDEX "issue_links_target_id_idx" ON "issue_links"("target_id");

-- CreateIndex
CREATE UNIQUE INDEX "issue_links_source_id_target_id_type_key" ON "issue_links"("source_id", "target_id", "type");

-- CreateIndex
CREATE INDEX "automation_rules_project_id_trigger_idx" ON "automation_rules"("project_id", "trigger");

-- CreateIndex
CREATE INDEX "automation_runs_rule_id_created_at_idx" ON "automation_runs"("rule_id", "created_at");

-- CreateIndex
CREATE INDEX "recurring_issues_enabled_next_run_at_idx" ON "recurring_issues"("enabled", "next_run_at");

-- CreateIndex
CREATE UNIQUE INDEX "project_issue_types_project_id_name_key" ON "project_issue_types"("project_id", "name");

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_release_id_fkey" FOREIGN KEY ("release_id") REFERENCES "releases"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_custom_type_id_fkey" FOREIGN KEY ("custom_type_id") REFERENCES "project_issue_types"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "releases" ADD CONSTRAINT "releases_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goals" ADD CONSTRAINT "goals_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_issues" ADD CONSTRAINT "goal_issues_goal_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "goal_issues" ADD CONSTRAINT "goal_issues_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_links" ADD CONSTRAINT "issue_links_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_links" ADD CONSTRAINT "issue_links_target_id_fkey" FOREIGN KEY ("target_id") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_links" ADD CONSTRAINT "issue_links_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_rules" ADD CONSTRAINT "automation_rules_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_rules" ADD CONSTRAINT "automation_rules_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_rule_id_fkey" FOREIGN KEY ("rule_id") REFERENCES "automation_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "automation_runs" ADD CONSTRAINT "automation_runs_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_issues" ADD CONSTRAINT "recurring_issues_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_issue_types" ADD CONSTRAINT "project_issue_types_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Fix versions are now built in (TQL `release`, aliases fixVersion / version). A custom field
-- with one of those names could no longer be searched, so rename it.
UPDATE "custom_fields" AS f SET "name" = 'Target release'
WHERE lower(f."name") IN ('release', 'fixversion', 'version')
  AND NOT EXISTS (
    SELECT 1 FROM "custom_fields" o WHERE o."project_id" = f."project_id" AND o."name" = 'Target release'
  );
