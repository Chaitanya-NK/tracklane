-- CreateEnum
CREATE TYPE "SprintState" AS ENUM ('planned', 'active', 'completed');

-- AlterTable
ALTER TABLE "issues" ADD COLUMN     "sprint_id" TEXT;

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "sprint_counter" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "sprints" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "goal" TEXT NOT NULL DEFAULT '',
    "state" "SprintState" NOT NULL DEFAULT 'planned',
    "start_date" DATE,
    "end_date" DATE,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "committed_points" INTEGER,
    "completed_points" INTEGER,
    "completed_issues" INTEGER,
    "incomplete_issues" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sprints_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sprints_project_id_state_idx" ON "sprints"("project_id", "state");

-- CreateIndex
CREATE INDEX "issues_sprint_id_idx" ON "issues"("sprint_id");

-- CreateIndex
CREATE INDEX "issues_project_id_position_idx" ON "issues"("project_id", "position");

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_sprint_id_fkey" FOREIGN KEY ("sprint_id") REFERENCES "sprints"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sprints" ADD CONSTRAINT "sprints_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
