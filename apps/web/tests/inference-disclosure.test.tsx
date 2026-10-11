import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "@/components/app-shell";
import { DecisionMatrix, TaskInspector } from "@/components/features/decision-matrix";
import { tasks } from "@/components/features/reference-data";
import { resetRuntimeCache } from "@/lib/api";
import { initialDashboardState, telemetryReducer } from "@/lib/telemetry";
import type { AgentView, TelemetryEvent } from "@/types";

vi.mock("next/navigation", () => ({ usePathname: () => "/" }));

const runtime = (inference_mode: string) =>
  new Response(JSON.stringify({ api_version: "1.0.0", python: "3.13", executor: "single-process-thread", checkpoint: "memory", inference_mode }), { status: 200, headers: { "Content-Type": "application/json" } });

const riskTask = tasks.find((task) => task.id === "risk-analysis")!;
const agent = (simulated: boolean): AgentView => ({ id: "risk-analysis", role: "Change risk", status: "COMPLETED", modelClass: "FAST", provider: "litellm", model: "fast", placement: "eu-api", routeReason: "low risk", fallbackAllowed: false, policyOutcome: "ALLOWED", latency: 25, promptTokens: 6, completionTokens: 7, cost: 0.00001, simulated, outcome: "Success" });

describe("inference mode badge", () => {
  beforeEach(() => resetRuntimeCache());
  afterEach(() => vi.unstubAllGlobals());

  it("reads SIMULATED MODEL CALLS next to the synthetic-data badge in fake mode", async () => {
    const fetcher = vi.fn().mockResolvedValue(runtime("fake"));
    vi.stubGlobal("fetch", fetcher);
    render(<AppShell>content</AppShell>);
    const badge = await screen.findByText("SIMULATED MODEL CALLS");
    expect(badge.parentElement).toHaveTextContent("DEMO · SYNTHETIC DATA");
    expect(badge.previousElementSibling).toHaveTextContent("DEMO · SYNTHETIC DATA");
    expect(fetcher).toHaveBeenCalledWith("/api/v1/runtime", expect.anything());
  });

  it("reads LIVE MODEL CALLS when the control plane reports a live gateway", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(runtime("litellm")));
    render(<AppShell>content</AppShell>);
    expect(await screen.findByText("LIVE MODEL CALLS")).toBeInTheDocument();
    expect(screen.queryByText("SIMULATED MODEL CALLS")).not.toBeInTheDocument();
  });

  it("never claims live calls when the runtime cannot be read", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 503 })));
    render(<AppShell>content</AppShell>);
    expect(await screen.findByText("MODEL CALLS UNVERIFIED")).toBeInTheDocument();
    expect(screen.queryByText("LIVE MODEL CALLS")).not.toBeInTheDocument();
  });

  it("fetches the runtime once across shell remounts", async () => {
    const fetcher = vi.fn().mockResolvedValue(runtime("fake"));
    vi.stubGlobal("fetch", fetcher);
    const { unmount } = render(<AppShell>first</AppShell>);
    await screen.findByText("SIMULATED MODEL CALLS");
    unmount();
    render(<AppShell>second</AppShell>);
    await screen.findByText("SIMULATED MODEL CALLS");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});

describe("simulated telemetry tag", () => {
  it("tags latency and tokens in the inspector when the invocation was simulated", () => {
    render(<TaskInspector task={riskTask} agents={[agent(true)]} onClose={vi.fn()} />);
    const inspector = screen.getByRole("complementary", { name: "Task inspector" });
    expect(within(inspector).getByText("Latency").parentElement).toHaveTextContent(/25 ms\s*simulated/);
    expect(within(inspector).getByText("Tokens").parentElement).toHaveTextContent(/13\s*simulated/);
  });

  it("omits the tag in the inspector for a live invocation", () => {
    render(<TaskInspector task={riskTask} agents={[agent(false)]} onClose={vi.fn()} />);
    expect(screen.queryByText("simulated")).not.toBeInTheDocument();
  });

  it("tags the matrix card metrics when the invocation was simulated", () => {
    const { container } = render(<DecisionMatrix agents={[agent(true)]} onSelect={vi.fn()} />);
    const cards = [...container.querySelectorAll<HTMLElement>('[data-task-id="risk-analysis"]')];
    expect(cards.length).toBeGreaterThan(0);
    for (const card of cards) expect(within(card).getByText("simulated")).toBeInTheDocument();
  });

  it("derives the simulated flag only from invocation events", () => {
    const base = initialDashboardState;
    const event = (overrides: Partial<TelemetryEvent>): TelemetryEvent => ({ schema_version: "1.0", event_id: Math.random().toString(), sequence: 1, execution_id: "e1", correlation_id: "c1", timestamp: new Date(0).toISOString(), event_type: "agent.completed", agent_id: "risk-analysis", status: "COMPLETED", model_class: null, provider: null, latency_ms: null, prompt_tokens: null, completion_tokens: null, estimated_cost_eur: null, trace_id: null, ...overrides });
    const invoked = telemetryReducer(base, event({ sequence: 1, latency_ms: 25, prompt_tokens: 6, completion_tokens: 7, simulated: true }));
    expect(invoked.agents["risk-analysis"].simulated).toBe(true);
    const later = telemetryReducer(invoked, event({ sequence: 2, event_type: "agent.message", simulated: false }));
    expect(later.agents["risk-analysis"].simulated).toBe(true);
  });
});
