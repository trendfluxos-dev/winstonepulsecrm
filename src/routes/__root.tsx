import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import { Toaster } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { MustChangePasswordGate } from "@/components/crm/MustChangePasswordGate";
import { FloorLockGate } from "@/components/crm/FloorLockGate";
import { MaintenanceGate } from "@/components/crm/MaintenanceNotice";
import { TemporaryClosureNotice } from "@/components/crm/TemporaryClosureNotice";
import { supabase } from "@/integrations/supabase/client";
import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { isModuleLoadError, MODULE_LOAD_ERROR_PATTERN } from "../lib/module-load-error";
import { buildDeployRecoveryScript } from "../lib/deploy-recovery-script";

const DEPLOY_RECOVERY_SCRIPT = buildDeployRecoveryScript({ dev: import.meta.env.DEV, pattern: MODULE_LOAD_ERROR_PATTERN });

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Button asChild><Link to="/">Go home</Link></Button>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  const appError = error instanceof Error ? error : new Error(String(error));
  const moduleFailure = isModuleLoadError(appError);
  const router = useRouter();
  useEffect(() => {
    // Router-caught lazy-import errors do not necessarily reach window.onerror
    // or Vite's preload event. Feed them into the same bounded recovery path.
    if (moduleFailure) {
      window.dispatchEvent(new CustomEvent("winstone:module-load-error", { detail: appError.message }));
      return;
    }
    console.error(appError);
    reportLovableError(appError, { boundary: "tanstack_root_error_component" });
  }, [appError, moduleFailure]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {moduleFailure ? "Loading the latest version" : "This page didn't load"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {moduleFailure ? "Your saved work is unchanged. Please wait, or refresh this page." : "Something went wrong on our end. You can try refreshing or head back home."}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Button
            onClick={() => {
              if (moduleFailure) {
                window.location.reload();
                return;
              }
              router.invalidate();
              reset();
            }}
          >
            Try again
          </Button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "google-site-verification", content: "pUD5ufdP9fb3xS36_ge0Nh6wa0gj1bYVww3jofy2f10" },
      {
        name: "viewport",
        content:
          "width=device-width, initial-scale=1, viewport-fit=cover",
      },
      { title: "Winstone Pulse — The Premium Real Estate CRM" },
      {
        name: "description",
        content: "উইনস্টোন টিমের কল, লিড ও রিপোর্ট — ফোনের হোম স্ক্রিন থেকেই চলবে।",
      },
      { property: "og:title", content: "Winstone Pulse — The Premium Real Estate CRM" },
      {
        property: "og:description",
        content: "উইনস্টোন টিমের কল, লিড ও রিপোর্ট — ফোনের হোম স্ক্রিন থেকেই চলবে।",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      // Home-screen install (manifest-only; no offline caching).
      { name: "theme-color", content: "#F5F2EA" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "apple-mobile-web-app-title", content: "Winstone" },
    ],
    links: [
      { rel: "manifest", href: "/manifest.webmanifest" },
      // Self-hosted fonts (see @font-face in styles.css): preloading the two
      // first-paint faces removes the external Google Fonts round-trip that
      // used to block rendering.
      { rel: "preload", as: "font", type: "font/woff2", href: "/fonts/inter-400-latin.woff2", crossOrigin: "anonymous" },
      { rel: "preload", as: "font", type: "font/woff2", href: "/fonts/hind-siliguri-400-bengali.woff2", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: appCss,
      },
      { rel: "icon", type: "image/png", sizes: "32x32", href: "/icons/favicon-32.png" },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "apple-touch-icon", href: "/icons/apple-touch-icon.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  const developmentCacheReset = import.meta.env.DEV
    ? `
      (() => {
        if (!("serviceWorker" in navigator) || sessionStorage.getItem("winstone-dev-cache-reset-v2")) return;
        sessionStorage.setItem("winstone-dev-cache-reset-v2", "1");
        Promise.all([
          navigator.serviceWorker.getRegistrations().then((items) => Promise.all(items.map((item) => item.unregister()))),
          "caches" in window
            ? caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith("winstone-shell-")).map((key) => caches.delete(key))))
            : Promise.resolve(),
        ]).then(() => {
          if (navigator.serviceWorker.controller) window.location.reload();
        });
      })();
    `
    : "";

  return (
    <html lang="en">
      <head>
        <HeadContent />
        {/* Keep both account tags: router metadata deduplicates matching names. */}
        <meta name="google-site-verification" content="tU1YnZ0DLOJD9UE-0F2T0SsLpryTRQddNltnpVWANvQ" />
        {/* Recover from stale/failed script downloads (see deploy-recovery-script.ts):
            probe page + assets before reloading, at most three backed-off reloads,
            then a fallback screen with Try again. The flag clears once the app boots. */}
        <script
          dangerouslySetInnerHTML={{
            __html: DEPLOY_RECOVERY_SCRIPT,
          }}
        />
      </head>
      <body>
        {developmentCacheReset ? (
          <script dangerouslySetInnerHTML={{ __html: developmentCacheReset }} />
        ) : null}
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  const sandboxOnly = useRouterState({ select: state => state.location.pathname === "/call-sandbox" });

  // The app booted — clear the one-time deployment reload flag so the next
  // deployment can recover normally again.
  useEffect(() => {
    (window as unknown as { __clearDeployReloadFlag?: () => void }).__clearDeployReloadFlag?.();
  }, []);

  // One place that reacts to sign-in / sign-out so every board refetches with
  // the new identity.
  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      void router.invalidate();
      if (event !== "SIGNED_OUT") void queryClient.invalidateQueries();
    });
    return () => data.subscription.unsubscribe();
  }, [queryClient, router]);

  // Offline shell: lets an installed CRM open and keep working without internet.
  // Writes still go through the local queue and only sync when the network is back.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;

    // A service worker must never cache Vite's development module graph. Mixing
    // modules from two HMR revisions can load two incompatible React runtimes.
    if (import.meta.env.DEV) {
      void navigator.serviceWorker.getRegistrations().then((registrations) =>
        Promise.all(registrations.map((registration) => registration.unregister())),
      );
      if (typeof caches !== "undefined") {
        void caches.keys().then((keys) =>
          Promise.all(keys.filter((key) => key.startsWith("winstone-shell-")).map((key) => caches.delete(key))),
        );
      }
      return;
    }

    void navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" }).catch(() => {
      /* offline shell unavailable — the app still works online */
    });
  }, []);


  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
      {/* The floor notice must cover every signed-in route, including the home page. */}
      {!sandboxOnly && <MustChangePasswordGate />}
      {!sandboxOnly && <FloorLockGate />}
      {/* Monthly maintenance banner / lock screen — the server enforces the lock itself. */}
      {!sandboxOnly && <MaintenanceGate />}
      {/* Temporary IT closure covers home, agent, coordinator, HQ and IT surfaces. */}
      {!sandboxOnly && <TemporaryClosureNotice />}
      <Toaster position="top-right" />
    </QueryClientProvider>
  );
}
