import { createFileRoute } from "@tanstack/react-router";
import { CrmWalkthrough } from "@/components/crm/CrmWalkthrough";

export const Route = createFileRoute("/walkthrough")({
  head: () => ({ meta: [
    { title: "CRM Walkthrough — Winstone Pulse" },
    { name: "description", content: "Interactive guide to Sales Agent, LeadHub Nexus, Executive HQ and IT Console workflows, responsibilities and evidence boundaries." },
    { property: "og:title", content: "CRM Walkthrough — Winstone Pulse" },
    { property: "og:description", content: "Explore daily calls, lead intake, follow-ups, reviews, recordings and integrations step by step." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: CrmWalkthrough,
});