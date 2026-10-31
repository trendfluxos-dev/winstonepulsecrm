// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const fixture = vi.hoisted(() => ({ submit: vi.fn(), connected: true }));
vi.mock("@tanstack/react-start", () => ({ useServerFn: (fn: unknown) => fn }));
vi.mock("@/lib/call-reports.functions", () => ({
  myPendingReport: async () => ({ report: { id: "local-ui-report", connected: fixture.connected, duration_seconds: 3 }, lead: { name: "Synthetic", phone_number: "" }, recording: null }),
  submitMyReport: (args: unknown) => fixture.submit(args),
}));
vi.mock("@/lib/inventory.functions", () => ({ listInventory: async () => ({ items: [{ label: "4 Bedroom" }] }) }));
vi.mock("@/lib/local-session", () => ({ useAdminToken: () => null }));
vi.mock("@/lib/report-draft", () => ({ loadReportDraft: () => null, saveReportDraft: vi.fn(), clearReportDraft: vi.fn() }));
vi.mock("@/lib/offline-queue", () => ({ subscribeQueue: () => () => {}, enqueue: vi.fn() }));
vi.mock("@/components/crm/DictateButton", () => ({ DictateButton: () => null }));
vi.mock("sonner", () => ({ toast: { info: vi.fn(), warning: vi.fn(), success: vi.fn(), error: vi.fn() } }));
import { PostCallReportGate } from "@/components/crm/PostCallReportGate";

let client: QueryClient;
beforeEach(() => {
  fixture.submit.mockReset(); fixture.connected = true;
  localStorage.setItem("winstone.lang", "en");
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
});
afterEach(() => { cleanup(); client.clear(); });
async function open() {
  render(React.createElement(QueryClientProvider, { client }, React.createElement(PostCallReportGate)));
  await screen.findByLabelText(/^Lead Category/);
}
function choose(category: string) { fireEvent.change(screen.getByLabelText(/^Lead Category/), { target: { value: category } }); }
function absentSalesInputs() {
  for (const label of ["Requirement", "Next Action", "Customer Interest", "Customer Response", "Grade"]) expect(screen.queryByLabelText(new RegExp(`^${label}`))).toBeNull();
  expect(screen.queryByText("4 Bedroom")).toBeNull();
  expect(screen.queryByText("Send Price")).toBeNull();
  expect(screen.queryByText("Send Details")).toBeNull();
  expect(screen.queryAllByRole("button", { name: "Yes", exact: true })).toHaveLength(0);
  expect(screen.queryAllByRole("button", { name: "No", exact: true })).toHaveLength(0);
  expect(screen.queryByRole("textbox", { name: "Follow-up date and time" })).toBeNull();
  expect(screen.queryByRole("radiogroup", { name: /^Grade/ })).toBeNull();
}
function fillSales(answer: (i: number) => "Yes" | "No" | null = () => "Yes") {
  for (const [label, value] of [["Customer Interest", "high"], ["Requirement", "4 Bedroom"], ["Customer Response", "interested"], ["Next Action", "send_price"]]) {
    fireEvent.change(screen.getByLabelText(new RegExp(`^${label}`)), { target: { value } });
  }
  fireEvent.click(screen.getByRole("button", { name: "No Follow-up Required" }));
  fireEvent.change(screen.getByRole("combobox", { name: "Reason no follow-up is needed" }), { target: { value: "info_completed" } });
  const yes = screen.getAllByRole("button", { name: "Yes", exact: true });
  const no = screen.getAllByRole("button", { name: "No", exact: true });
  yes.forEach((button, i) => { const a = answer(i); if (a) fireEvent.click(a === "Yes" ? button : no[i]!); });
}
const submitButton = () => screen.getByRole("button", { name: "Confirm & Submit" }) as HTMLButtonElement;
describe("actual mobile report interactions with isolated server fixtures", () => {
  for (const category of ["not_interested", "wrong_number", "fake"]) it(`${category} immediately removes every irrelevant input and sends only rejection facts`, async () => {
    await open(); choose(category); absentSalesInputs();
    expect((screen.getByRole("button", { name: "Confirm & Submit" }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Confirm & Submit" }));
    await waitFor(() => expect(fixture.submit).toHaveBeenCalledTimes(1));
    expect(fixture.submit.mock.calls[0]?.[0]).toMatchObject({ data: { category, requirement: null, nextAction: "no_action", evaluationAnswers: null, followUpAt: null, followUpNeeded: false, temperature: null, grade: null } });
  });
  it("normal Interested still requires property/action selections and all six answers", async () => {
    await open(); choose("interested");
    for (const label of ["Requirement", "Next Action", "Customer Interest", "Customer Response"]) expect(screen.getByLabelText(new RegExp(`^${label}`))).toBeTruthy();
    expect(screen.getAllByRole("button", { name: "Yes", exact: true })).toHaveLength(6);
    expect((screen.getByRole("button", { name: "Confirm & Submit" }) as HTMLButtonElement).disabled).toBe(true);
  });
  it("connected sales call renders a visible A/B/C/D grade selector", async () => {
    await open(); choose("interested");
    const group = screen.getByRole("radiogroup", { name: /^Grade/ });
    expect(group).toBeTruthy();
    expect(screen.getAllByRole("radio").map((r) => r.id)).toEqual(["sr-grade-A", "sr-grade-B", "sr-grade-C", "sr-grade-D"]);
  });
  it("missing grade blocks submit with an inline actionable message", async () => {
    await open(); choose("interested"); fillSales();
    expect(submitButton().disabled).toBe(true);
    expect(screen.getByText("Grade missing — choose A, B, C or D above, then submit")).toBeTruthy();
    fireEvent.click(submitButton());
    expect(fixture.submit).not.toHaveBeenCalled();
  });
  it("missing any one of the six answers blocks submit even with a grade", async () => {
    await open(); choose("interested"); fillSales((i) => (i === 3 ? null : "No"));
    fireEvent.click(screen.getByRole("radio", { name: /^B/ }));
    expect(submitButton().disabled).toBe(true);
    expect(fixture.submit).not.toHaveBeenCalled();
  });
  for (const g of ["A", "B", "C", "D"]) it(`selecting grade ${g} satisfies validation and submits six explicit answers`, async () => {
    await open(); choose("interested"); fillSales();
    expect(submitButton().disabled).toBe(true);
    fireEvent.click(screen.getByRole("radio", { name: new RegExp(`^${g}`) }));
    expect(screen.getByRole("radio", { name: new RegExp(`^${g}`) }).getAttribute("aria-checked")).toBe("true");
    expect(screen.queryByText("Grade missing — choose A, B, C or D above, then submit")).toBeNull();
    fireEvent.click(submitButton());
    await waitFor(() => expect(fixture.submit).toHaveBeenCalledTimes(1));
    expect(fixture.submit.mock.calls[0]?.[0]).toMatchObject({ data: { grade: g, evaluationAnswers: {
      project_interest: true, asked_price: true, wanted_info: true, visit_interest: true, decision_30d: true, wants_follow_up: true,
    } } });
  });
  it("arrow keys move the grade selection (keyboard accessible)", async () => {
    await open(); choose("interested");
    const a = screen.getByRole("radio", { name: /^A/ });
    fireEvent.keyDown(a, { key: "ArrowRight" });
    expect(screen.getByRole("radio", { name: /^B/ }).getAttribute("aria-checked")).toBe("true");
  });
  it("unanswered call (no answer) shows no grade or sales questions", async () => {
    fixture.connected = false; await open(); choose("no_answer");
    expect(screen.queryByRole("radiogroup", { name: /^Grade/ })).toBeNull();
    expect(screen.queryAllByRole("button", { name: "Yes", exact: true })).toHaveLength(0);
  });
  it("outcome correction needs confirmation and a new selection; cancellation keeps rejection", async () => {
    await open(); choose("wrong_number");
    fireEvent.click(screen.getByRole("button", { name: "Correct an incorrectly selected outcome" }));
    fireEvent.click(screen.getByRole("button", { name: "Keep current outcome" })); absentSalesInputs();
    fireEvent.click(screen.getByRole("button", { name: "Correct an incorrectly selected outcome" }));
    fireEvent.click(screen.getByRole("button", { name: "Select correct outcome" }));
    expect((screen.getByRole("button", { name: "Confirm & Submit" }) as HTMLButtonElement).disabled).toBe(true);
    choose("interested"); expect(screen.getAllByRole("button", { name: "Yes", exact: true })).toHaveLength(6);
  });
  it("stale sales choices cannot survive a rejection payload", async () => {
    await open(); choose("interested");
    fireEvent.change(screen.getByLabelText(/^Requirement/), { target: { value: "4 Bedroom" } });
    fireEvent.change(screen.getByLabelText(/^Next Action/), { target: { value: "send_price" } });
    choose("fake"); absentSalesInputs();
    fireEvent.click(screen.getByRole("button", { name: "Confirm & Submit" }));
    await waitFor(() => expect(fixture.submit).toHaveBeenCalled());
    expect(fixture.submit.mock.calls[0]?.[0]).toMatchObject({ data: { requirement: null, nextAction: "no_action" } });
  });
  it("final rejection disposition is independent of connection status", async () => {
    fixture.connected = false; await open(); choose("fake"); absentSalesInputs();
    expect((screen.getByRole("button", { name: "Confirm & Submit" }) as HTMLButtonElement).disabled).toBe(false);
    expect(fixture.submit).not.toHaveBeenCalled();
  });
});