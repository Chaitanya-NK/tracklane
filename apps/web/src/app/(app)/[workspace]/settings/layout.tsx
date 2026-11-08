import { PageHeader } from "@/components/shared/page-header";
import { SettingsTabs } from "./settings-tabs";

export default function SettingsLayout({ children }: LayoutProps<"/[workspace]/settings">) {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Workspace settings"
        description="Manage your workspace and who has access to it."
      />
      <SettingsTabs />
      <div className="max-w-4xl">{children}</div>
    </div>
  );
}
