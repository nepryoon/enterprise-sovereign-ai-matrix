"use client";

import { useMemo, useState } from "react";

import { StatusBadge } from "@/components/status-badge";
import type { AgentView } from "@/types";
import { agentFor, disciplines, phases, tasks, type Task } from "./reference-data";

export function DecisionMatrix({
  agents,
  onSelect,
  selected,
}: {
  agents: AgentView[];
  onSelect: (task: Task) => void;
  selected?: string;
}) {
  const [query, setQuery] = useState("");
  const [discipline, setDiscipline] = useState("All");
  const shown = useMemo(
    () =>
      tasks.filter(
        (task) =>
          (discipline === "All" || task.discipline === discipline) &&
          `${task.title} ${task.id}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [query, discipline],
  );
  const selectedTask = tasks.find((task) => task.id === selected);

  function isRelated(task: Task) {
    return Boolean(
      selectedTask &&
        (selectedTask.dependencies.includes(task.id) || task.dependencies.includes(selectedTask.id)),
    );
  }

  function moveFocus(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (!["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp", "Home", "End"].includes(event.key)) {
      return;
    }
    const group = event.currentTarget.closest(".matrix-desktop,.matrix-mobile");
    const buttons = [...(group?.querySelectorAll<HTMLButtonElement>(".task-card") ?? [])];
    const current = buttons.indexOf(event.currentTarget);
    if (current < 0 || buttons.length === 0) return;
    event.preventDefault();
    const delta = event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1;
    const target = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1 :
      (current + delta + buttons.length) % buttons.length;
    buttons[target]?.focus();
  }

  function card(task: Task) {
    const agent = agentFor(task, agents);
    const status = agent?.status ?? "READY";
    return (
      <button
        key={task.id}
        className={`task-card ${selected === task.id ? "selected" : ""} ${
          isRelated(task) ? "related" : ""
        }`}
        data-task-id={task.id}
        onClick={() => onSelect(task)}
        onKeyDown={moveFocus}
        aria-label={`${task.title}, ${status}`}
        aria-pressed={selected === task.id}
      >
        <span className="task-id">{task.id}</span>
        <b>{task.title}</b>
        <StatusBadge status={status} />
        <span className="task-meta">
          <span>{agent?.modelClass ?? "NO INVOCATION"}</span>
          {agent?.provider ? <span>{agent.provider}</span> : null}
        </span>
        {agent && agent.promptTokens + agent.completionTokens > 0 ? (
          <span className="task-metrics">
            {agent.promptTokens + agent.completionTokens} tok · €{agent.cost.toFixed(5)}
          </span>
        ) : null}
      </button>
    );
  }

  return (
    <section className="matrix-panel panel">
      <div className="matrix-toolbar">
        <div>
          <span className="eyebrow">Live decision matrix</span>
          <h2>Observe → governed decision</h2>
        </div>
        <label className="search">
          <span className="sr-only">Search tasks</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search agents…"
          />
        </label>
        <label>
          <span className="sr-only">Filter discipline</span>
          <select value={discipline} onChange={(event) => setDiscipline(event.target.value)}>
            <option>All</option>
            {disciplines.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
      </div>
      <div
        className="matrix-scroll"
        role="region"
        aria-label="Decision matrix; use arrow keys to move between tasks"
        tabIndex={0}
      >
        <div className="decision-grid matrix-desktop">
          <div className="grid-corner">DISCIPLINE / PHASE</div>
          {phases.map((phase) => <div className="phase-header" key={phase}>{phase}</div>)}
          {disciplines.map((row) => (
            <div className="matrix-row" key={row} style={{ display: "contents" }}>
              <div className="discipline-header">{row}</div>
              {phases.map((phase) => (
                <div className="matrix-cell" key={phase}>
                  {shown.filter((task) => task.phase === phase && task.discipline === row).map(card)}
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="matrix-mobile">
          {phases.map((phase) => {
            const phaseTasks = shown.filter((task) => task.phase === phase);
            if (!phaseTasks.length) return null;
            return (
              <section key={phase} aria-labelledby={`phase-${phase}`}>
                <h3 id={`phase-${phase}`} className="phase-header">{phase}</h3>
                <div className="mobile-phase-cards">{phaseTasks.map(card)}</div>
              </section>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function TaskInspector({
  task,
  agents,
  onClose,
}: {
  task: Task | null;
  agents: AgentView[];
  onClose: () => void;
}) {
  if (!task) {
    return (
      <aside className="inspector panel empty-inspector">
        <span aria-hidden>⌁</span>
        <h2>Inspect decision lineage</h2>
        <p>Select a task to reveal dependencies, authoritative route and execution telemetry.</p>
      </aside>
    );
  }
  const agent = agentFor(task, agents);
  return (
    <aside className="inspector panel" aria-label="Task inspector">
      <button className="icon-button close-inspector" onClick={onClose} aria-label="Close inspector">
        ×
      </button>
      <span className="eyebrow">Task inspector</span>
      <code>{task.id}</code>
      <h2>{task.title}</h2>
      <StatusBadge status={agent?.status ?? "READY"} />
      <section><h3>Summary</h3><p>{task.summary}</p></section>
      <dl>
        <div><dt>Discipline</dt><dd>{task.discipline}</dd></div>
        <div><dt>Phase</dt><dd>{task.phase}</dd></div>
        <div><dt>Model class</dt><dd>{agent?.modelClass ?? "No invocation"}</dd></div>
        <div><dt>Provider</dt><dd>{agent?.provider ?? "No invocation"}</dd></div>
        <div><dt>Model</dt><dd>{agent?.model ?? "No invocation"}</dd></div>
        <div><dt>Placement</dt><dd>{agent?.placement ?? "No invocation"}</dd></div>
        <div><dt>Route rationale</dt><dd>{agent?.routeReason ?? "No routed invocation"}</dd></div>
        <div>
          <dt>Fallback</dt>
          <dd>{agent?.fallbackAllowed == null ? "Not applicable" : agent.fallbackAllowed ? "Permitted" : "Prohibited"}</dd>
        </div>
        <div><dt>Policy</dt><dd>{agent?.policyOutcome ?? "Not evaluated"}</dd></div>
        {agent ? (
          <>
            <div><dt>Latency</dt><dd>{agent.latency} ms</dd></div>
            <div><dt>Tokens</dt><dd>{agent.promptTokens + agent.completionTokens}</dd></div>
            <div><dt>Cost</dt><dd>€{agent.cost.toFixed(5)}</dd></div>
          </>
        ) : null}
      </dl>
      <section>
        <h3>Dependencies</h3>
        <p>{task.dependencies.length ? task.dependencies.join(" → ") : "Workflow origin"}</p>
      </section>
    </aside>
  );
}
