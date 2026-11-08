-- CreateEnum
CREATE TYPE "ApprovalState" AS ENUM ('pending', 'approved', 'rejected', 'cancelled');

-- CreateEnum
CREATE TYPE "CustomFieldType" AS ENUM ('text', 'number', 'date', 'select', 'multiselect', 'user', 'checkbox', 'url');

-- CreateEnum
CREATE TYPE "TqlFunctionKind" AS ENUM ('condition', 'values');

-- AlterTable
ALTER TABLE "projects" ADD COLUMN     "backlog_status_id" TEXT,
ADD COLUMN     "restrict_transitions" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "workflow_transitions" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "from_status_id" TEXT NOT NULL,
    "to_status_id" TEXT NOT NULL,
    "requires_approval" BOOLEAN NOT NULL DEFAULT false,
    "approver_role" "WorkspaceRole" NOT NULL DEFAULT 'admin',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_transitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_requests" (
    "id" TEXT NOT NULL,
    "issue_id" TEXT NOT NULL,
    "from_status_id" TEXT NOT NULL,
    "to_status_id" TEXT NOT NULL,
    "approver_role" "WorkspaceRole" NOT NULL,
    "state" "ApprovalState" NOT NULL DEFAULT 'pending',
    "requested_by_id" TEXT,
    "decided_by_id" TEXT,
    "decided_at" TIMESTAMP(3),
    "note" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_fields" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "type" "CustomFieldType" NOT NULL,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "custom_field_options" (
    "id" TEXT NOT NULL,
    "field_id" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT 'gray',
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "custom_field_options_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issue_field_values" (
    "issue_id" TEXT NOT NULL,
    "field_id" TEXT NOT NULL,
    "text_value" TEXT,
    "number_value" DOUBLE PRECISION,
    "date_value" DATE,
    "bool_value" BOOLEAN,
    "user_id" TEXT,
    "option_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "issue_field_values_pkey" PRIMARY KEY ("issue_id","field_id")
);

-- CreateTable
CREATE TABLE "tql_functions" (
    "id" TEXT NOT NULL,
    "workspace_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "kind" "TqlFunctionKind" NOT NULL,
    "body" TEXT NOT NULL DEFAULT '',
    "value_kind" TEXT,
    "values" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tql_functions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "workflow_transitions_project_id_idx" ON "workflow_transitions"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_transitions_from_status_id_to_status_id_key" ON "workflow_transitions"("from_status_id", "to_status_id");

-- CreateIndex
CREATE INDEX "approval_requests_issue_id_state_idx" ON "approval_requests"("issue_id", "state");

-- CreateIndex
CREATE INDEX "approval_requests_state_idx" ON "approval_requests"("state");

-- CreateIndex
CREATE UNIQUE INDEX "custom_fields_project_id_name_key" ON "custom_fields"("project_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "custom_field_options_field_id_value_key" ON "custom_field_options"("field_id", "value");

-- CreateIndex
CREATE INDEX "issue_field_values_field_id_idx" ON "issue_field_values"("field_id");

-- CreateIndex
CREATE UNIQUE INDEX "tql_functions_workspace_id_name_key" ON "tql_functions"("workspace_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "projects_backlog_status_id_key" ON "projects"("backlog_status_id");

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_backlog_status_id_fkey" FOREIGN KEY ("backlog_status_id") REFERENCES "workflow_statuses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_transitions" ADD CONSTRAINT "workflow_transitions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_transitions" ADD CONSTRAINT "workflow_transitions_from_status_id_fkey" FOREIGN KEY ("from_status_id") REFERENCES "workflow_statuses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workflow_transitions" ADD CONSTRAINT "workflow_transitions_to_status_id_fkey" FOREIGN KEY ("to_status_id") REFERENCES "workflow_statuses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_from_status_id_fkey" FOREIGN KEY ("from_status_id") REFERENCES "workflow_statuses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_to_status_id_fkey" FOREIGN KEY ("to_status_id") REFERENCES "workflow_statuses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_decided_by_id_fkey" FOREIGN KEY ("decided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_fields" ADD CONSTRAINT "custom_fields_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_field_options" ADD CONSTRAINT "custom_field_options_field_id_fkey" FOREIGN KEY ("field_id") REFERENCES "custom_fields"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_field_values" ADD CONSTRAINT "issue_field_values_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "issues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_field_values" ADD CONSTRAINT "issue_field_values_field_id_fkey" FOREIGN KEY ("field_id") REFERENCES "custom_fields"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issue_field_values" ADD CONSTRAINT "issue_field_values_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tql_functions" ADD CONSTRAINT "tql_functions_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tql_functions" ADD CONSTRAINT "tql_functions_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
