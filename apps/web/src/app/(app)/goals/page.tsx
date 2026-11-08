import type { Metadata } from "next";
import { ComingSoon } from "@/components/shared/coming-soon";

export const metadata: Metadata = { title: "Goals" };

export default function Page() {
  return <ComingSoon title="Goals" phase={8} />;
}
