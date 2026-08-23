"use client";

import { useCallback, useEffect, useMemo, useReducer, useState } from "react";

import { ApprovalModal } from "@/components/approval-modal";
import { AppShell, PageHeading } from "@/components/app-shell";
import { DecisionMatrix, TaskInspector } from "@/components/features/decision-matrix";
import { DecisionTheatre } from "@/components/features/decision-theatre";
import type { Task } from "@/components/features/reference-data";
import { useExecutionStream } from "@/hooks/use-execution-stream";
import { createExecution, decide, getExecution } from "@/lib/api";
import { initialDashboardState, telemetryReducer } from "@/lib/telemetry";

export function MissionControl() {
  const [state, dispatch] = useReducer(telemetryReducer, initialDashboardState);
  const [request, setRequest] = useState(
    "Assess a synthetic EU critical-infrastructure control-system change for sovereign deployment.",
  );
  const [scenario, setScenario] = useState("HIGH_RISK");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Task | null>(null);
  const [approvalOpen, setApprovalOpen] = useState(true);
  const executionId = state.execution?.execution_id ?? null;

  const connection = useCallback(
    (value: "connecting" | "connected" | "reconnecting" | "error") =>
      dispatch({ type: "connection", value }),
    [],
  );

  const reconcile = useCallback(async () => {
    if (!executionId) return;
    try {
      dispatch({
        type: "execution",
        execution: await getExecution(executionId),
        preserve: true,
      });
    } catch (error) {
      dispatch({
        type: "error",
        error: error instanceof Error ? error.message : "State reconciliation failed",
      });
    }
  }, [executionId]);

  useExecutionStream(
    executionId,
    (event) => {
      dispatch(event);
      if (event.event_type === "approval.requested") setApprovalOpen(true);
      if (
        event.event_type.startsWith("approval.") ||
        event.event_type.startsWith("execution.")
      ) {
        void reconcile();
      }
    },
    connection,
  );

  useEffect(() => {
    if (state.execution?.status === "WAITING_APPROVAL") setApprovalOpen(true);
  }, [state.execution?.execution_id, state.execution?.status]);

  async function start() {
    setBusy(true);
    try {
      const execution = await createExecution({ request, scenario });
      dispatch({ type: "execution", execution });
      setSelected(null);
      setApprovalOpen(true);
    } catch (error) {
      dispatch({
        type: "error",
        error: error instanceof Error ? error.message : "Unable to start execution",
      });
    } finally {
      setBusy(false);
    }
  }

  async function decision(choice: "approve" | "reject", reason: string) {
    if (!state.execution) return;
    setBusy(true);
    try {
      dispatch({
        type: "execution",
        execution: await decide(
          state.execution.execution_id,
          choice,
          reason || `${choice} recorded by control-plane operator`,
        ),
        preserve: true,
      });
      setApprovalOpen(false);
    } catch (error) {
      dispatch({
        type: "error",
        error: error instanceof Error ? error.message : "Decision failed",
      });
    } finally {
      setBusy(false);
    }
  }

  const agents = Object.values(state.agents);
  const totals = useMemo(
    () =>
      agents.reduce(
        (total, agent) => ({
          tokens: total.tokens + agent.promptTokens + agent.completionTokens,
          cost: total.cost + agent.cost,
        }),
        { tokens: 0, cost: 0 },
      ),
    [agents],
  );

  return (
    <AppShell
      executionId={state.execution?.execution_id}
      connection={state.connection}
      cost={totals.cost}
    >
      <div className="command-layout">
        <aside id="guided-demo" className="context-panel panel">
          <span className="eyebrow">Guided demo</span>
          <h2>EU critical infrastructure</h2>
          <p>
            Synthetic change assessment with sovereign routing, policy challenge and a real
            approval interrupt.
          </p>
          <label>
            Decision request
            <textarea
              aria-label="Decision request"
              value={request}
              onChange={(event) => setRequest(event.target.value)}
            />
          </label>
          <label>
            Scenario
            <select
              aria-label="Demo scenario"
              value={scenario}
              onChange={(event) => setScenario(event.target.value)}
            >
              <option value="SAFE">SAFE · automated</option>
              <option value="HIGH_RISK">HIGH RISK · HITL</option>
              <option value="SENSITIVE">SENSITIVE · sovereign</option>
              <option value="PROVIDER_FAILURE">PROVIDER FAILURE</option>
              <option value="TIMEOUT">TIMEOUT</option>
              <option value="MALFORMED_RESPONSE">MALFORMED RESPONSE</option>
            </select>
          </label>
          <button
            className="primary-action"
            disabled={busy || !request.trim()}
            onClick={() => void start()}
          >
            {busy ? "Dispatching…" : "Start guided demo"}
          </button>
          <div className="boundary">
            <i /> Residency policy active
            <strong>Restricted routes prohibit cloud fallback</strong>
          </div>
        </aside>

        <div className="command-main">
          <PageHeading
            eyebrow="Command centre / Active decision"
            title="Sovereign Decision Control Plane"
            description="Follow every agent from request intake to an accountable, auditable decision."
            actions={
              <div className="summary-strip">
                <span><b>{state.execution?.status ?? "STANDBY"}</b>Status</span>
                <span><b>{agents.length}</b>Agent runs</span>
                <span><b>{totals.tokens}</b>Tokens</span>
                {state.execution?.status === "WAITING_APPROVAL" && !approvalOpen ? (
                  <button className="approval-review" onClick={() => setApprovalOpen(true)}>
                    Review approval
                  </button>
                ) : null}
              </div>
            }
          />
          {state.error ? <div role="alert" className="error-banner">{state.error}</div> : null}
          <div className="matrix-inspector">
            <DecisionMatrix agents={agents} selected={selected?.id} onSelect={setSelected} />
            <TaskInspector task={selected} agents={agents} onClose={() => setSelected(null)} />
          </div>
          <div className="theatre-stack">
            <DecisionTheatre events={state.events} />
            <section className="event-shelf panel">
              <div>
                <span className="eyebrow">Versioned event contract</span>
                <h2>Execution lineage</h2>
              </div>
              <ol>
                {state.events.length ? (
                  [...state.events].reverse().slice(0, 7).map((event) => (
                    <li key={event.event_id}>
                      <span />
                      <code>{event.event_type}</code>
                      <small>{event.agent_id ?? "orchestrator"}</small>
                      <time>{new Date(event.timestamp).toLocaleTimeString()}</time>
                    </li>
                  ))
                ) : (
                  <li className="empty-event">
                    Launch the deterministic showcase to inspect live transitions.
                  </li>
                )}
              </ol>
            </section>
          </div>
        </div>
      </div>
      {state.execution?.status === "WAITING_APPROVAL" && approvalOpen ? (
        <ApprovalModal
          execution={state.execution}
          busy={busy}
          onDecision={decision}
          onDismiss={() => setApprovalOpen(false)}
        />
      ) : null}
    </AppShell>
  );
}
