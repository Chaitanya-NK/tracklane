-- Release checklists, time off, billable worklogs, timesheet approval and timers.
ALTER TABLE "worklogs" ADD COLUMN "billable" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "release_checklist_items" (
    "id" TEXT NOT NULL,
    "release_id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "release_checklist_items_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "release_checklist_items_release_id_position_idx" ON "release_checklist_items"("release_id", "position");
ALTER TABLE "release_checklist_items" ADD CONSTRAINT "release_checklist_items_release_id_fkey"
    FOREIGN KEY ("release_id") REFERENCES "releases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "time_off" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "note" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "time_off_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "time_off_workspace_id_start_date_idx" ON "time_off"("workspace_id", "start_date");
ALTER TABLE "time_off" ADD CONSTRAINT "time_off_workspace_id_fkey"
    FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "time_off" ADD CONSTRAINT "time_off_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TYPE "TimesheetStatus" AS ENUM ('submitted', 'approved', 'rejected');
CREATE TABLE "timesheet_submissions" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "week_start" DATE NOT NULL,
    "minutes" INTEGER NOT NULL,
    "status" "TimesheetStatus" NOT NULL DEFAULT 'submitted',
    "reviewer_id" TEXT,
    "note" TEXT NOT NULL DEFAULT '',
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decided_at" TIMESTAMP(3),
    CONSTRAINT "timesheet_submissions_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "timesheet_submissions_workspace_id_user_id_week_start_key"
    ON "timesheet_submissions"("workspace_id", "user_id", "week_start");
CREATE INDEX "timesheet_submissions_workspace_id_status_idx" ON "timesheet_submissions"("workspace_id", "status");
ALTER TABLE "timesheet_submissions" ADD CONSTRAINT "timesheet_submissions_workspace_id_fkey"
    FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "timesheet_submissions" ADD CONSTRAINT "timesheet_submissions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "timesheet_submissions" ADD CONSTRAINT "timesheet_submissions_reviewer_id_fkey"
    FOREIGN KEY ("reviewer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "active_timers" (
    "user_id" TEXT NOT NULL,
    "issue_id" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "active_timers_pkey" PRIMARY KEY ("user_id")
);
ALTER TABLE "active_timers" ADD CONSTRAINT "active_timers_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "active_timers" ADD CONSTRAINT "active_timers_issue_id_fkey"
    FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
