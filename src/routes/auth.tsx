import { useMutation } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, IdCard, Loader2, Lock, LogIn, Phone, User, UserPlus } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { toast } from "sonner";
import { z } from "zod";

import logoAsset from "@/assets/winstone-emblem.png.asset.json";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { signInWithIdentifier } from "@/lib/accounts.functions";
import { ensureRegistered, saveSignupDraft } from "@/lib/session";

const SearchSchema = z.object({
  role: z.literal("agent").catch("agent"),
  mode: z.enum(["signin", "signup"]).catch("signin"),
});

export const Route = createFileRoute("/auth")({
  validateSearch: (search) => SearchSchema.parse(search),
  head: () => ({
    meta: [
      { title: "Sign in — Winstone Pulse" },
      {
        name: "description",
        content:
          "Sales agents sign in to their Winstone Pulse desk, or create an account for approval.",
      },
      { property: "og:title", content: "Sign in — Winstone Pulse" },
      {
        property: "og:description",
        content: "Sales Agent access to the Winstone Pulse tele-sales floor.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

const ROLE_LABEL = { agent: "Sales Agent" } as const;

function AuthPage() {
  const { role, mode } = Route.useSearch();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const signIn = useMutation({
    mutationFn: async () => {
      const tokens = await signInWithIdentifier({
        data: { identifier: email.trim(), password },
      });
      const { error } = await supabase.auth.setSession(tokens);
      if (error) throw new Error(error.message);
      await ensureRegistered(name);
    },
    onSuccess: () => {
      toast.success("Signed in");
      void navigate({ to: "/desk" });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const signUp = useMutation({
    mutationFn: async () => {
      saveSignupDraft({ name, phone, requestedRole: role });
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      if (error) throw new Error(error.message);
      if (data.session) await ensureRegistered(name);
      return Boolean(data.session);
    },
    onSuccess: (hasSession) => {
      if (hasSession) {
        toast.success("Account created — waiting for approval");
        void navigate({ to: "/desk" });
      } else {
        toast.success("Account created — confirm your email, then sign in");
        void navigate({ to: "/auth", search: { role, mode: "signin" } });
      }
    },
    onError: (error: Error) => toast.error(error.message),
  });


  const isSignup = mode === "signup";
  const busy = signIn.isPending || signUp.isPending;
  const canSubmit =
    (isSignup ? email.includes("@") : email.trim().length >= 4) &&
    password.length >= 6 &&
    (!isSignup || name.trim().length >= 2);

  const submit = () => {
    if (!canSubmit || busy) return;
    if (isSignup) signUp.mutate();
    else signIn.mutate();
  };
  const errorMessage = (signIn.error ?? signUp.error)?.message;

  return (
    <div className="theme-light grid min-h-dvh bg-background lg:grid-cols-2">
      <aside className="relative hidden flex-col justify-between overflow-hidden border-r border-border bg-secondary p-12 lg:flex">
        <div className="absolute inset-x-12 top-24 h-px bg-border" aria-hidden />
        <span className="text-sm font-semibold tracking-[0.2em]">WINSTONE PULSE</span>
        <div>
          <h2 className="text-5xl font-semibold leading-tight tracking-tight">
            Call smarter,
            <br />
            close more homes.
          </h2>
          <p className="mt-4 max-w-md text-lg text-muted-foreground">
            The Premium Real Estate CRM. PULSE — Find. Build. Invest.
          </p>
          <div className="mt-10 max-w-sm rounded-2xl border border-border bg-card p-5 shadow-sm">
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              Booking status · preview
            </p>
            <div className="mt-4 grid grid-cols-3 gap-3 text-center">
              {[
                ["Leads", "50"],
                ["Visits", "6"],
                ["Bookings", "2"],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl bg-secondary p-3">
                  <p className="text-2xl font-semibold">{v}</p>
                  <p className="text-[11px] text-muted-foreground">{k}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-secondary">
              <div className="h-full w-2/3 rounded-full bg-primary" />
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">Illustrative sample, not live data</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">© 2026 Winstone Properties Ltd.</p>
      </aside>

      <div className="flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <Link to="/" className="flex items-center gap-3">
            <img
              src={logoAsset.url}
              alt="Winstone logo"
              className="size-11 rounded-full object-cover ring-1 ring-border"
            />
            <span>
              <span className="block text-sm font-bold tracking-tight">Winstone Pulse</span>
              <span className="block text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                {ROLE_LABEL[role]}
              </span>
            </span>
          </Link>

          <div className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
            <h1 className="text-2xl font-semibold tracking-tight">
              {isSignup ? "Create your account" : "Sign in to your desk"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isSignup
                ? "A supervisor approves new accounts before the floor data opens up."
                : "Use your phone number, Employee ID or email."}
            </p>

            <form
              className="mt-6 space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                submit();
              }}
            >
              {isSignup && (
                <>
                  <IconField id="name" label="Full name" icon={<User className="size-4" />}>
                    <Input
                      id="name"
                      className="h-11 pl-9"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Mst. Soniya Yeasmin"
                    />
                  </IconField>
                  <IconField id="phone" label="Phone" icon={<Phone className="size-4" />}>
                    <Input
                      id="phone"
                      className="h-11 pl-9"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="01805049668"
                      inputMode="tel"
                    />
                  </IconField>
                </>
              )}
              <IconField
                id="email"
                label={isSignup ? "Email" : "Phone / Employee ID / Email"}
                icon={<IdCard className="size-4" />}
              >
                <Input
                  id="email"
                  className="h-11 pl-9"
                  type={isSignup ? "email" : "text"}
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint="next"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={isSignup ? "you@winstonebd.com" : "01805049668 or WIN2601"}
                />
              </IconField>

              <IconField id="password" label="Password" icon={<Lock className="size-4" />}>
                <Input
                  id="password"
                  className="h-11 pl-9 pr-12"
                  enterKeyHint="go"
                  type={showPassword ? "text" : "password"}
                  autoComplete={isSignup ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 6 characters"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-0.5 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </IconField>

              {!isSignup && (
                <div className="flex justify-end">
                  <Link
                    to="/reset-password"
                    className="text-xs font-medium text-muted-foreground hover:text-foreground hover:underline"
                  >
                    Forgot password?
                  </Link>
                </div>
              )}

              <Button type="submit" className="h-11 w-full" disabled={!canSubmit || busy}>
                {busy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : isSignup ? (
                  <UserPlus className="size-4" />
                ) : (
                  <LogIn className="size-4" />
                )}
                {isSignup ? "Create account" : "Sign in"}
              </Button>

              

              {errorMessage && (
                <p role="alert" className="text-center text-sm text-destructive">
                  {errorMessage}
                </p>
              )}
            </form>

            <p className="mt-6 text-center text-sm text-muted-foreground">
              {isSignup ? "Already have an account? " : "New here? "}
              <Link
                to="/auth"
                search={{ role, mode: isSignup ? "signin" : "signup" }}
                className="font-semibold text-foreground hover:underline"
              >
                {isSignup ? "Sign in" : "Create account"}
              </Link>
            </p>
          </div>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            <Link to="/" className="hover:underline">
              Back to the entry hall
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

function IconField({
  id,
  label,
  icon,
  children,
}: {
  id: string;
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
          {icon}
        </span>
        {children}
      </div>
    </div>
  );
}
