import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Execution, TelemetryEvent } from "@/types";

const api = vi.hoisted(() => ({ createExecution: vi.fn(), decide: vi.fn(), getExecution: vi.fn() }));
const stream = vi.hoisted(() => ({ onEvent: null as ((event: TelemetryEvent) => void) | null }));
vi.mock("next/navigation", () => ({ usePathname: () => "/" }));
vi.mock("@/lib/api", () => ({ ...api, API_URL: "/api/v1" }));
vi.mock("@/hooks/use-execution-stream", () => ({
  useExecutionStream: (_id: string | null, onEvent: (event: TelemetryEvent) => void) => { stream.onEvent = onEvent; },
}));

import { MissionControl } from "@/components/mission-control";

const execution = (status: Execution["status"]): Execution => ({ execution_id: "exec-1", correlation_id: "cid", status, risk_level: "HIGH", data_sensitivity: "INTERNAL", current_node: "approval", created_at: "", updated_at: "", evidence: [] });
const event = (event_type: string): TelemetryEvent => ({ schema_version: "1", event_id: `${event_type}-${Math.random()}`, sequence: 1, execution_id: "exec-1", correlation_id: "cid", timestamp: new Date(0).toISOString(), event_type, agent_id: null, status: null, model_class: null, provider: null, latency_ms: null, prompt_tokens: null, completion_tokens: null, estimated_cost_eur: null, trace_id: null });
const reconcileTo = async (status: Execution["status"]) => { api.getExecution.mockResolvedValueOnce(execution(status)); await act(async () => { stream.onEvent?.(event("execution.started")); }); };

describe("MissionControl approval dialog", () => {
  beforeEach(() => { vi.clearAllMocks(); stream.onEvent = null; });
  it("stays dismissed while waiting and reopens when the execution re-enters WAITING_APPROVAL", async () => {
    const user = userEvent.setup();
    api.createExecution.mockResolvedValue(execution("WAITING_APPROVAL"));
    render(<MissionControl />);
    await user.click(screen.getByRole("button", { name: "Start guided demo" }));
    expect(await screen.findByRole("dialog", { name: "Human decision required" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await reconcileTo("WAITING_APPROVAL");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Review approval" })).toBeInTheDocument();
    await reconcileTo("RUNNING");
    await reconcileTo("WAITING_APPROVAL");
    expect(screen.getByRole("dialog", { name: "Human decision required" })).toBeInTheDocument();
  });
});
