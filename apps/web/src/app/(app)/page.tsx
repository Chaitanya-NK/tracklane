import type { Metadata } from "next";
import { HomeOverview } from "@/features/home";

export const metadata: Metadata = { title: "For you" };

export default function HomePage() {
  return <HomeOverview />;
}
