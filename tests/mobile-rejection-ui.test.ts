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
}
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