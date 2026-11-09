-- Onboarding answers, domain auto-join, activity, stars, integrations, API logs, roadmap votes.
ALTER TABLE "workspaces" ADD COLUMN "allowed_domain" TEXT,
    ADD COLUMN "team_size" TEXT,
    ADD COLUMN "use_cases" TEXT[] DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "workspace_members" ADD COLUMN "last_active_at" TIMESTAMP(3);

CREATE TABLE "issue_views" (
    "user_id" TEXT NOT NULL, "issue_id" TEXT NOT NULL,
    "viewed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "issue_views_pkey" PRIMARY KEY ("user_id", "issue_id")
);
CREATE INDEX "issue_views_user_id_viewed_at_idx" ON "issue_views"("user_id", "viewed_at");
ALTER TABLE "issue_views" ADD CONSTRAINT "issue_views_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "issue_views" ADD CONSTRAINT "issue_views_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "issue_stars" (
    "user_id" TEXT NOT NULL, "issue_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "issue_stars_pkey" PRIMARY KEY ("user_id", "issue_id")
);
ALTER TABLE "issue_stars" ADD CONSTRAINT "issue_stars_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "issue_stars" ADD CONSTRAINT "issue_stars_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "project_stars" (
    "user_id" TEXT NOT NULL, "project_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "project_stars_pkey" PRIMARY KEY ("user_id", "project_id")
);
ALTER TABLE "project_stars" ADD CONSTRAINT "project_stars_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_stars" ADD CONSTRAINT "project_stars_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TYPE "IntegrationKind" AS ENUM ('github', 'slack');
CREATE TABLE "integrations" (
    "id" TEXT NOT NULL, "workspace_id" TEXT NOT NULL, "kind" "IntegrationKind" NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}', "secret" TEXT, "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "integrations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "integrations_workspace_id_kind_key" ON "integrations"("workspace_id", "kind");
ALTER TABLE "integrations" ADD CONSTRAINT "integrations_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TYPE "DevLinkKind" AS ENUM ('branch', 'pull_request', 'commit');
CREATE TABLE "dev_links" (
    "id" TEXT NOT NULL, "issue_id" TEXT NOT NULL, "kind" "DevLinkKind" NOT NULL,
    "external_id" TEXT NOT NULL, "title" TEXT NOT NULL, "url" TEXT NOT NULL, "state" TEXT,
    "author" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "dev_links_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "dev_links_issue_id_kind_external_id_key" ON "dev_links"("issue_id", "kind", "external_id");
ALTER TABLE "dev_links" ADD CONSTRAINT "dev_links_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "api_request_logs" (
    "id" TEXT NOT NULL, "workspace_id" TEXT NOT NULL, "token_id" TEXT,
    "method" TEXT NOT NULL, "path" TEXT NOT NULL, "status" INTEGER NOT NULL, "duration_ms" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "api_request_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "api_request_logs_workspace_id_created_at_idx" ON "api_request_logs"("workspace_id", "created_at");
ALTER TABLE "api_request_logs" ADD CONSTRAINT "api_request_logs_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "roadmap_votes" (
    "issue_id" TEXT NOT NULL, "voter_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "roadmap_votes_pkey" PRIMARY KEY ("issue_id", "voter_key")
);
ALTER TABLE "roadmap_votes" ADD CONSTRAINT "roadmap_votes_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "roadmap_subscribers" (
    "project_id" TEXT NOT NULL, "email" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "roadmap_subscribers_pkey" PRIMARY KEY ("project_id", "email")
);
ALTER TABLE "roadmap_subscribers" ADD CONSTRAINT "roadmap_subscribers_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "webhooks" ADD COLUMN "format" TEXT NOT NULL DEFAULT 'json';
