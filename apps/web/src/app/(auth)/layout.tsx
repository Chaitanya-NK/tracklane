import Link from "next/link";
import { BrandMark } from "@/components/shared/brand-mark";
import { siteConfig } from "@/config/site";

const highlights = [
  "Scrum and Kanban boards, backlogs and sprints",
  "Timelines, goals and dashboards for the whole team",
  "A REST API and webhooks for your own tooling",
];

/** Split-screen frame for sign-in, sign-up and password reset. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col p-6 md:p-10">
        <Link href="/sign-in" className="flex items-center gap-2 font-semibold">
          <BrandMark className="size-7" />
          {siteConfig.name}
        </Link>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </div>
      <aside className="relative hidden flex-col justify-end overflow-hidden bg-muted p-10 lg:flex">
        <div
          aria-hidden="true"
          className="absolute inset-0 [background-image:radial-gradient(var(--border)_1px,transparent_1px)] [background-size:22px_22px] opacity-70"
        />
        <div className="relative space-y-6">
          <p className="text-2xl font-semibold tracking-tight text-balance">
            Plan sprints, track issues and ship — in one place your whole team can see.
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {highlights.map((item) => (
              <li key={item} className="flex items-center gap-2">
                <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
