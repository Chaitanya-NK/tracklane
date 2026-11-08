import type { Metadata } from "next";
import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata: Metadata = { title: "Dashboards" };

export default function Page() {
  return <ComingSoon title="Dashboards" phase={7} />;
}
