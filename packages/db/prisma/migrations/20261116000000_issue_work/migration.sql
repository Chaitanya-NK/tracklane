-- Threaded comments, reactions, components, WIP limits, flags and sprint capacity.
ALTER TABLE "comments" ADD COLUMN "parent_id" TEXT;
CREATE INDEX "comments_parent_id_idx" ON "comments"("parent_id");
ALTER TABLE "comments" ADD CONSTRAINT "comments_parent_id_fkey"
    FOREIGN KEY ("parent_id") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "comment_reactions" (
    "comment_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "emoji" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "comment_reactions_pkey" PRIMARY KEY ("comment_id", "user_id", "emoji")
);
ALTER TABLE "comment_reactions" ADD CONSTRAINT "comment_reactions_comment_id_fkey"
    FOREIGN KEY ("comment_id") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "comment_reactions" ADD CONSTRAINT "comment_reactions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "project_components" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "lead_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "project_components_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "project_components_project_id_name_key" ON "project_components"("project_id", "name");
ALTER TABLE "project_components" ADD CONSTRAINT "project_components_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_components" ADD CONSTRAINT "project_components_lead_id_fkey"
    FOREIGN KEY ("lead_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "issue_components" (
    "issue_id" TEXT NOT NULL,
    "component_id" TEXT NOT NULL,
    CONSTRAINT "issue_components_pkey" PRIMARY KEY ("issue_id", "component_id")
);
CREATE INDEX "issue_components_component_id_idx" ON "issue_components"("component_id");
ALTER TABLE "issue_components" ADD CONSTRAINT "issue_components_issue_id_fkey"
    FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "issue_components" ADD CONSTRAINT "issue_components_component_id_fkey"
    FOREIGN KEY ("component_id") REFERENCES "project_components"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "workflow_statuses" ADD COLUMN "wip_limit" INTEGER;
ALTER TABLE "issues" ADD COLUMN "flagged" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "sprint_capacities" (
    "sprint_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "days_off" INTEGER NOT NULL DEFAULT 0,
    "points" INTEGER,
    CONSTRAINT "sprint_capacities_pkey" PRIMARY KEY ("sprint_id", "user_id")
);
ALTER TABLE "sprint_capacities" ADD CONSTRAINT "sprint_capacities_sprint_id_fkey"
    FOREIGN KEY ("sprint_id") REFERENCES "sprints"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "sprint_capacities" ADD CONSTRAINT "sprint_capacities_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
