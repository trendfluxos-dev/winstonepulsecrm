import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/messenger-setup")({
  head: () => ({ meta: [
    { title: "Messenger Setup Progress — Winstone Pulse" },
    { name: "description", content: "Winstone Messenger setup prerequisites, unverified App and Page approvals and activation blockers." },
    { property: "og:title", content: "Messenger Setup Progress — Winstone Pulse" },
    { property: "og:description", content: "Honest Messenger preparation status, webhook readiness and activation blockers." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  beforeLoad: () => { throw redirect({ to: "/messenger", replace: true }); },
});