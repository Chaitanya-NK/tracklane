import type { Metadata } from "next";
import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata: Metadata = { title: "Filters" };

export default function Page() {
  return <ComingSoon title="Filters" phase={4} />;
}
