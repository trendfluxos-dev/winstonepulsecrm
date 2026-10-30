import { z } from "zod";

/** Fixed pass/fail checks agents run on the test APK. Keys are stored; labels live in the UI. */
export const PHONE_TEST_CHECKS = ["install", "signin", "call_detected", "recording_upload", "rejection_report", "normal_report"] as const;
export type PhoneTestCheck = (typeof PHONE_TEST_CHECKS)[number];

export const PhoneTestReportSchema = z.object({
  phoneModel: z.string().trim().min(2).max(80),
  appVersion: z.string().trim().max(30).optional(),
  results: z.object(Object.fromEntries(PHONE_TEST_CHECKS.map((k) => [k, z.enum(["pass", "fail"])])) as Record<PhoneTestCheck, z.ZodEnum<["pass", "fail"]>>),
  issue: z.string().trim().max(1000).optional(),
  sendToIt: z.boolean(),
}).superRefine((v, ctx) => {
  const failed = Object.values(v.results).some((r) => r === "fail");
  if (failed && !v.issue) ctx.addIssue({ code: "custom", path: ["issue"], message: "Describe what failed" });
});
export type PhoneTestReportInput = z.infer<typeof PhoneTestReportSchema>;

export const failedCount = (r: Record<string, "pass" | "fail">) => Object.values(r).filter((x) => x === "fail").length;
