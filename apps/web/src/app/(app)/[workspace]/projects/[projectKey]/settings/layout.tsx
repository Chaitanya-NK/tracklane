import { ProjectSettingsTabs } from "@/features/projects";

export default function ProjectSettingsLayout({
  children,
}: LayoutProps<"/[workspace]/projects/[projectKey]/settings">) {
  return (
    <div className="space-y-6">
      <ProjectSettingsTabs />
      {children}
    </div>
  );
}
