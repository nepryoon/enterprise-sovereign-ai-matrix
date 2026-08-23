import type { DashboardState, ExecutionStatus, TelemetryEvent } from "@/types";

export const initialDashboardState: DashboardState = {
  execution: null,
  events: [],
  agents: {},
  connection: "idle",
  error: null,
};

const roles: Record<string, string> = {
  "ingest-request": "Request intake",
  "sensitivity-classifier": "Data sovereignty",
  "triage-agent": "Operational triage",
  "risk-analysis": "Change risk",
  "policy-evaluator": "Policy assurance",
  "decision-finaliser": "Decision synthesis",
  "approval-gate": "Human governance",
  risk_analysis: "Change risk",
};

export type DashboardAction =
  | TelemetryEvent
  | { type: "execution"; execution: NonNullable<DashboardState["execution"]>; preserve?: boolean }
  | { type: "connection"; value: DashboardState["connection"] }
  | { type: "error"; error: string };

export function telemetryReducer(
  state: DashboardState,
  event: DashboardAction,
): DashboardState {
  if ("type" in event) {
    if (event.type === "execution") {
      const changed = state.execution?.execution_id !== event.execution.execution_id;
      return changed && !event.preserve
        ? { ...initialDashboardState, execution: event.execution, connection: state.connection }
        : { ...state, execution: event.execution, error: null };
    }
    if (event.type === "connection") {
      return { ...state, connection: event.value };
    }
    return { ...state, error: event.error };
  }

  if (state.events.some((existing) => existing.event_id === event.event_id)) return state;
  if (state.execution && event.execution_id !== state.execution.execution_id) return state;
  const agents = { ...state.agents };
  if (event.agent_id) {
    const old = agents[event.agent_id] ?? {
      id: event.agent_id,
      role: roles[event.agent_id] ?? "Decision agent",
      status: "QUEUED",
      modelClass: null,
      provider: null,
      model: null,
      placement: null,
      routeReason: null,
      fallbackAllowed: null,
      policyOutcome: null,
      latency: 0,
      promptTokens: 0,
      completionTokens: 0,
      cost: 0,
      outcome: "Pending",
    };
    agents[event.agent_id] = {
      ...old,
      status: event.status ?? old.status,
      modelClass: event.model_class ?? old.modelClass,
      provider: event.provider ?? old.provider,
      model: event.model ?? old.model,
      placement: event.placement ?? old.placement,
      routeReason: event.route_reason ?? old.routeReason,
      fallbackAllowed: event.fallback_allowed ?? old.fallbackAllowed,
      policyOutcome: event.policy_outcome ?? old.policyOutcome,
      latency: event.latency_ms ?? old.latency,
      promptTokens: event.prompt_tokens ?? old.promptTokens,
      completionTokens: event.completion_tokens ?? old.completionTokens,
      cost: event.estimated_cost_eur ?? old.cost,
      outcome:
        event.event_type === "agent.failed"
          ? "Failed"
          : event.event_type === "agent.completed"
            ? "Success"
            : old.outcome,
    };
  }

  const isAuthoritativeTransition = event.event_type.startsWith("execution.") || event.event_type.startsWith("approval.");
  const status = isAuthoritativeTransition && event.status
    ? event.status as ExecutionStatus
    : state.execution?.status;

  return {
    ...state,
    agents,
    events: [...state.events, event].sort((left, right) => left.sequence - right.sequence),
    execution:
      state.execution && status
        ? { ...state.execution, status }
        : state.execution,
    connection: "connected",
    error: null,
  };
}
