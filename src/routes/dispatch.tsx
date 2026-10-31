import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/dispatch")({
  head: () => ({ meta: [
    { title: "Dispatch moved to LeadHub Nexus — Winstone Pulse" },
    { name: "description", content: "Lead operations have moved to LeadHub Nexus." },
    { property: "og:title", content: "Dispatch moved to LeadHub Nexus — Winstone Pulse" },
    { property: "og:description", content: "The old dispatch page now opens LeadHub Nexus, where leads are imported and assigned." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: () => <Navigate to="/leadhub" replace />,
});
