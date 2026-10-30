import { createFileRoute, redirect } from "@tanstack/react-router";

// The version chooser was retired (owner, 2026-10-30); old links go to sign-in.
export const Route = createFileRoute("/versions")({
  beforeLoad: () => {
    throw redirect({ to: "/signin", replace: true });
  },
});
