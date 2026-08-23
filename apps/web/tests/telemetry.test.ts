import { describe, expect, it } from "vitest";
import { initialDashboardState, telemetryReducer } from "@/lib/telemetry";
import type { TelemetryEvent } from "@/types";
let eventSequence = 0;
const event = (overrides: Partial<TelemetryEvent> = {}): TelemetryEvent => ({ schema_version:"1.0", event_id:`event-${++eventSequence}`, sequence:eventSequence, execution_id:"e1", correlation_id:"c1", timestamp:"2026-08-22T12:00:00Z", event_type:"agent.completed", agent_id:"risk_analysis", status:"COMPLETED", model_class:"REASONING", provider:"litellm", latency_ms:420, prompt_tokens:125, completion_tokens:68, estimated_cost_eur:.00042, trace_id:"trace-1", ...overrides });
describe("telemetryReducer", () => {
  it("projects SSE metrics into an agent row", () => { const state = telemetryReducer(initialDashboardState, event()); expect(state.agents.risk_analysis).toMatchObject({ role:"Change risk", status:"COMPLETED", promptTokens:125, outcome:"Success" }); expect(state.events).toHaveLength(1); });
  it("renders waiting and failure status transitions", () => { const base = telemetryReducer(initialDashboardState, { type:"execution", execution:{ execution_id:"e1",correlation_id:"c1",status:"RUNNING",risk_level:"HIGH",data_sensitivity:"PUBLIC",current_node:"policy",created_at:"",updated_at:"" } }); const waiting = telemetryReducer(base,event({event_type:"approval.requested",agent_id:null,status:"WAITING_APPROVAL"})); expect(waiting.execution?.status).toBe("WAITING_APPROVAL"); expect(telemetryReducer(waiting,event({event_type:"execution.failed",agent_id:null,status:"FAILED"})).execution?.status).toBe("FAILED"); });
  it("records reconnect and error states", () => { const reconnect = telemetryReducer(initialDashboardState,{type:"connection",value:"reconnecting"}); expect(reconnect.connection).toBe("reconnecting"); expect(telemetryReducer(reconnect,{type:"error",error:"stream unavailable"}).error).toBe("stream unavailable"); });
});

describe("normalised execution isolation and idempotency",()=>{
  it("clears projections when selecting another execution",()=>{const populated=telemetryReducer(initialDashboardState,event());const next=telemetryReducer(populated,{type:"execution",execution:{execution_id:"e2",correlation_id:"c2",status:"QUEUED",risk_level:"LOW",data_sensitivity:"PUBLIC",current_node:"queued",created_at:"",updated_at:""}});expect(next.events).toEqual([]);expect(next.agents).toEqual({})});
  it("deduplicates event ids",()=>{const same=event({event_id:"stable"});const once=telemetryReducer(initialDashboardState,same);expect(telemetryReducer(once,same).events).toHaveLength(1)});
  it("honours an authoritative cancelled terminal status",()=>{const base=telemetryReducer(initialDashboardState,{type:"execution",execution:{execution_id:"e1",correlation_id:"c1",status:"WAITING_APPROVAL",risk_level:"HIGH",data_sensitivity:"PUBLIC",current_node:"approval",created_at:"",updated_at:""}});const rejected=telemetryReducer(base,event({event_type:"approval.rejected",agent_id:null,status:"CANCELLED"}));expect(rejected.execution?.status).toBe("CANCELLED")});
});
