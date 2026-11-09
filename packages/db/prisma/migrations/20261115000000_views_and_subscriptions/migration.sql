-- Filter email digests and saved project list views.
CREATE TYPE "DigestFrequency" AS ENUM ('daily', 'weekly');

CREATE TABLE "filter_subscriptions" (
    "filter_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "frequency" "DigestFrequency" NOT NULL DEFAULT 'daily',
    "last_sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "filter_subscriptions_pkey" PRIMARY KEY ("filter_id", "user_id")
);
CREATE INDEX "filter_subscriptions_user_id_idx" ON "filter_subscriptions"("user_id");
ALTER TABLE "filter_subscriptions" ADD CONSTRAINT "filter_subscriptions_filter_id_fkey"
    FOREIGN KEY ("filter_id") REFERENCES "saved_filters"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "filter_subscriptions" ADD CONSTRAINT "filter_subscriptions_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "project_views" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "owner_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "params" TEXT NOT NULL DEFAULT '',
    "group_by" TEXT NOT NULL DEFAULT 'none',
    "columns" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "shared" BOOLEAN NOT NULL DEFAULT false,
    "editable" BOOLEAN NOT NULL DEFAULT false,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "project_views_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "project_views_project_id_idx" ON "project_views"("project_id");
ALTER TABLE "project_views" ADD CONSTRAINT "project_views_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "project_views" ADD CONSTRAINT "project_views_owner_id_fkey"
    FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
