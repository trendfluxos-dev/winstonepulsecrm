/**
 * The ONE canonical System Manual lives in docs/CRM_OPERATIONS_MANUAL.md.
 * The /manual page, the HQ / IT reference cards and the downloadable PDF are
 * all built from that file — edit it, then run `npm run manual:pdf`.
 */
import manualMarkdown from "../../docs/CRM_OPERATIONS_MANUAL.md?raw";
import { parseManual } from "@/lib/manual-source";
import manualMeta from "../../public/winstone-system-manual.json";

export type { ManualSection } from "@/lib/manual-source";

const parsed = parseManual(manualMarkdown);

export const MANUAL_VERSION = parsed.version;
export const MANUAL_UPDATED = parsed.updated;
export const MANUAL_SECTIONS = parsed.sections;
export const MANUAL_PDF_PATH = "/winstone-system-manual.pdf";
/** Metadata written by `npm run manual:pdf`; manual:check fails CI when it drifts from the Markdown. */
export const MANUAL_PDF_META = manualMeta as { version: string; updated: string; sourceSha256: string; pdfSha256: string };
