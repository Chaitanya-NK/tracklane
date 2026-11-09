import { PageHeader } from "@/components/shared/page-header";
import { TeamsTabs } from "./teams-tabs";

export default function TeamsLayout({ children }: LayoutProps<"/[workspace]/teams">) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Team"
        description="Who's working on what across every project, and where the time went."
      />
      <TeamsTabs />
      {children}
    </div>
  );
}
