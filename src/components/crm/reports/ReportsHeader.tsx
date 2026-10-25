import { Download, Filter } from "lucide-react";

import { CopilotDrawer } from "@/components/crm/CopilotDrawer";
import { Button } from "@/components/ui/button";
import { useT } from "@/lib/i18n";

/** Reports page title, filter toggle (mobile) and CSV export controls. */
export function ReportsHeader({
  onToggleFilters,
  onExport,
}: {
  onToggleFilters: () => void;
  onExport: () => void;
}) {
  const t = useT();
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h1 className="truncate text-xl font-bold tracking-tight sm:text-2xl">
          {t({ bn: "রিপোর্ট", en: "Reports" })}
        </h1>
        <p className="text-xs text-muted-foreground sm:text-sm">
          {t({ bn: "কাজের হিসাব এক নজরে — কল, লিড আর ফলাফল।", en: "The team's work at a glance — calls, leads and results." })}
        </p>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" className="lg:hidden" onClick={onToggleFilters}>
          <Filter className="size-4" /> {t({ bn: "ছেঁকে দেখুন", en: "Filters" })}
        </Button>
        <Button variant="outline" size="sm" onClick={onExport}>
          <Download className="size-4" /> {t({ bn: "ডাউনলোড", en: "Export" })}
        </Button>
        <CopilotDrawer />
      </div>
    </div>
  );
}
