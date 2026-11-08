import { can } from "@tracklane/core";
import type { Metadata } from "next";
import { Suspense } from "react";
import { HeadingSkeleton, TableSkeleton } from "@/components/shared/skeletons";
import { FieldsManager } from "@/features/custom-fields";
import { listCustomFields } from "@/features/custom-fields/server";
import { getProjectAccess } from "@/server/authz";

export const metadata: Metadata = { title: "Fields" };

type Props = PageProps<"/[workspace]/projects/[projectKey]/settings/fields">;

async function Fields({ params }: { params: Props["params"] }) {
  const { workspace: slug, projectKey } = await params;
  const { project, role } = await getProjectAccess(slug, projectKey);
  const fields = await listCustomFields(project.id);
  return (
    <div className="max-w-4xl">
      <FieldsManager
        slug={slug}
        projectKey={project.key}
        fields={fields}
        canEdit={can(role, "projects:update")}
      />
    </div>
  );
}

export default function FieldsSettingsPage({ params }: Props) {
  return (
    <Suspense
      fallback={
        <div className="max-w-4xl space-y-3">
          <HeadingSkeleton />
          <TableSkeleton />
        </div>
      }
    >
      <Fields params={params} />
    </Suspense>
  );
}
