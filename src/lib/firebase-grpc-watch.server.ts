import { evaluateFirebase, shouldAlert, GRPC_ADVISORY, GRPC_FIXED_VERSION } from "@/lib/firebase-grpc-watch";

const WATCH_KEY = "firebase_grpc_watch";
const REGISTRY = "https://registry.npmjs.org";

async function manifest(path: string): Promise<{ version: string; dependencies?: Record<string, string> }> {
  const res = await fetch(`${REGISTRY}/${path}`, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`registry ${res.status}`);
  const body = (await res.json()) as { version?: unknown; dependencies?: Record<string, string> };
  if (typeof body.version !== "string") throw new Error("registry manifest invalid");
  return { version: body.version, dependencies: body.dependencies };
}

/** Daily check: has a Firebase release resolved the @grpc/grpc-js advisory? Alerts IT once. */
export async function runFirebaseGrpcWatch() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: stored, error: readError } = await supabaseAdmin.from("system_settings").select("value").eq("key", WATCH_KEY).maybeSingle();
  if (readError) throw new Error("Watch state unavailable");
  const previous = (stored?.value as { alertedFor?: string | null } | null) ?? null;

  const firebase = await manifest("firebase/latest");
  const fsVersion = firebase.dependencies?.["@firebase/firestore"];
  const firestore = fsVersion ? await manifest(`@firebase/firestore/${encodeURIComponent(fsVersion)}`) : null;
  const verdict = evaluateFirebase(firebase, firestore);

  const alert = shouldAlert(verdict, previous);
  if (alert) {
    const { error } = await supabaseAdmin.from("system_alerts").insert({
      code: "firebase_grpc_fix_available",
      severity: "info",
      title: `Firebase ${verdict.firebaseVersion} এখন নিরাপদ @grpc/grpc-js (${GRPC_FIXED_VERSION}+) ব্যবহার করতে পারে`,
      detail: JSON.stringify({ advisory: GRPC_ADVISORY, ...verdict }),
      action: "IT: firebase আপডেট করে নিরাপত্তা স্ক্যান আবার চালান, তারপর পাবলিশ করুন।",
    });
    if (error) throw new Error("Alert could not be saved");
  }

  const { error: saveError } = await supabaseAdmin.from("system_settings").upsert(
    { key: WATCH_KEY, value: { ...verdict, checkedAt: new Date().toISOString(), alertedFor: alert ? verdict.firebaseVersion : (previous?.alertedFor ?? null) } as never },
    { onConflict: "key" },
  );
  if (saveError) throw new Error("Watch state could not be saved");
  return { firebase: verdict.firebaseVersion, grpcRange: verdict.grpcRange, fixed: verdict.fixed, alerted: alert };
}
