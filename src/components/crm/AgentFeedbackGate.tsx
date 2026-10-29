import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { agentFeedbackSchema, feedbackWindow } from "@/lib/agent-feedback";
import { getAgentFeedbackStatus, submitAgentFeedback } from "@/lib/agent-feedback.functions";
export function AgentFeedbackGate() {
  const qc = useQueryClient();
  const load = useServerFn(getAgentFeedbackStatus);
  const submit = useServerFn(submitAgentFeedback);
  const [now, setNow] = useState(0);
  const [form, setForm] = useState({ problem: "", impact: "", improvement: "" });
  useEffect(() => { setNow(Date.now()); const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const active = feedbackWindow(now);
  const q = useQuery({ queryKey: ["agent-morning-feedback"], queryFn: () => load(), enabled: active, retry: false, staleTime: 60_000 });
  const save = useMutation({ mutationFn: () => submit({ data: agentFeedbackSchema.parse(form) }), onSuccess: result => { qc.setQueryData(["agent-morning-feedback"], result); } });
  const valid = agentFeedbackSchema.safeParse(form);
  return <AlertDialog open={active && (q.data?.required === true || q.isError)}>
    <AlertDialogContent className="max-h-[90dvh] max-w-lg overflow-y-auto" onEscapeKeyDown={e => e.preventDefault()}>
      <AlertDialogHeader><AlertDialogTitle>আজকের সিস্টেম সমস্যা ও চাহিদা</AlertDialogTitle><AlertDialogDescription>শুধু আজ সকাল ৯:৩০ ঢাকা পর্যন্ত। বিস্তারিত লিখে জমা দেওয়ার পর কাজ করুন। সমস্যা না থাকলে সেটিও স্পষ্ট লিখুন। গ্রাহকের তথ্য বা পাসওয়ার্ড লিখবেন না।</AlertDialogDescription></AlertDialogHeader>
      {([ ["problem", "আসল সমস্যা বা বর্তমান অবস্থা", 1500], ["impact", "কাজে কী প্রভাব পড়ছে / কখন ঘটছে", 800], ["improvement", "কী আপডেট বা সহায়তা প্রয়োজন", 1000] ] as const).map(([key, label, max]) => <label key={key} className="space-y-1 text-sm">{label}<Textarea aria-label={label} rows={3} maxLength={max} value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })} /></label>)}
      {(save.isError || q.isError) && <p role="alert" className="text-sm text-destructive">{save.error?.message ?? q.error?.message}</p>}
      <Button disabled={!valid.success || save.isPending || q.isError} onClick={() => save.mutate()}>{save.isPending ? "জমা হচ্ছে…" : "জমা দিয়ে কাজ শুরু করুন"}</Button>
      {q.isError && <Button variant="outline" onClick={() => void q.refetch()}>আবার যাচাই করুন</Button>}
    </AlertDialogContent>
  </AlertDialog>;
}