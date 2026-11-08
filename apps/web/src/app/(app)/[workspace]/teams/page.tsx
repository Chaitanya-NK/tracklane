import type { Metadata } from "next";
import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata: Metadata = { title: "Teams" };

export default function Page() {
  return <ComingSoon title="Teams" phase={7} />;
}
