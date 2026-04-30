import type { Metadata } from "next";

import StoryCheckerPage from "@/app/components/story-checker/StoryCheckerPage";

export const metadata: Metadata = {
  title: "Narrative Checker App",
  description: "Analyze story events, graph structure, and narrative inconsistencies.",
};

export default function AppPage() {
  return <StoryCheckerPage />;
}
