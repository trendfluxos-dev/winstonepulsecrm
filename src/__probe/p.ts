import { createServerFn } from "@tanstack/react-start";
export const f = createServerFn({ method: "POST" }).inputValidator((i: unknown) => i as { a: string }).handler(async () => ({ x: 1 }));
export const g = createServerFn({ method: "POST" }).handler(async () => ({ x: 1 }));
type R = Awaited<ReturnType<typeof f>>; type S = Awaited<ReturnType<typeof g>>;
const r: R = null as any; const s: S = null as any;
export const t1: number = r.x; export const t2: number = s.x;
