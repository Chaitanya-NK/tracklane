import type { Metadata } from "next";
import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata: Metadata = { title: "Projects" };

export default function Page() {
  return <ComingSoon title="Projects" phase={2} />;
}
