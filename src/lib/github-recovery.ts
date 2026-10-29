export function githubRecovery(message: string) {
  if (message.includes("Full IT PIN")) return { retry: false, kind: "access" as const };
  if (/HTTP_401|HTTP_403|CONNECTION_NOT_CONFIGURED/.test(message)) return { retry: false, kind: "connection" as const };
  if (message.includes("HTTP_404")) return { retry: false, kind: "repository" as const };
  return { retry: true, kind: "temporary" as const };
}