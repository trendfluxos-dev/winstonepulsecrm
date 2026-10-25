import { createFileRoute } from "@tanstack/react-router";
import { handleLeadReportSchedule } from "@/lib/lead-report-schedule.server";

export const Route = createFileRoute("/api/public/jobs/lead-report-sheet")({
  server: { handlers: { POST: ({ request }) => handleLeadReportSchedule(request) } },
});