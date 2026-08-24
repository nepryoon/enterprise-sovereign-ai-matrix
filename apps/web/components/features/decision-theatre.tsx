"use client";

import { useMemo, useState } from "react";

import type { TelemetryEvent } from "@/types";

function label(value: string | null | undefined) {
  return (value ?? "control-plane").replaceAll("-", " ");
}

export function DecisionTheatre({ events }: { events: TelemetryEvent[] }) {
  const messages = useMemo(
    () => events.filter((event) => event.event_type === "agent.message" && event.message),
    [events],
  );
  const actors = useMemo(
    () => [...new Set(messages.flatMap((event) => [event.agent_id, event.recipient]).filter(Boolean))] as string[],
    [messages],
  );
  const [actor, setActor] = useState("ALL");
  const visible = actor === "ALL"
    ? messages
    : messages.filter((event) => event.agent_id === actor || event.recipient === actor);

  return (
    <section className="theatre-panel panel" aria-labelledby="theatre-heading">
      <header className="theatre-header">
        <div>
          <span className="eyebrow">Decision Theatre · persisted handoffs</span>
          <h2 id="theatre-heading">Agent conversation</h2>
        </div>
        <label>
          <span className="sr-only">Filter conversation by participant</span>
          <select value={actor} onChange={(event) => setActor(event.target.value)}>
            <option value="ALL">All participants</option>
            {actors.map((item) => <option key={item} value={item}>{label(item)}</option>)}
          </select>
        </label>
      </header>
      <div className="theatre-body">
        <aside className="participant-rail" aria-label="Conversation participants">
          {actors.length ? actors.map((item) => (
            <button
              key={item}
              className={actor === item ? "active" : ""}
              onClick={() => setActor(item)}
              aria-pressed={actor === item}
            >
              <span aria-hidden>{item.slice(0, 2).toUpperCase()}</span>
              {label(item)}
            </button>
          )) : <p>Agents appear here as the workflow advances.</p>}
        </aside>
        <ol className="conversation" aria-live="polite" aria-label="Persisted agent handoffs">
          {visible.length ? visible.map((event) => (
            <li key={event.event_id}>
              <div className="message-route">
                <strong>{label(event.agent_id)}</strong>
                <span aria-hidden>→</span>
                <b>{label(event.recipient)}</b>
                <time dateTime={event.timestamp}>
                  #{event.sequence} · {new Date(event.timestamp).toLocaleTimeString()}
                </time>
              </div>
              <p>{event.message}</p>
              <footer>
                <span>{event.message_kind ?? "handoff"}</span>
                <span>SYNTHETIC</span>
                {(event.evidence_refs ?? []).map((reference) => (
                  <code key={reference}>{reference}</code>
                ))}
              </footer>
            </li>
          )) : (
            <li className="conversation-empty">
              <strong>Decision Theatre ready</strong>
              <p>Select a scenario and start the guided demo to stream persisted agent handoffs.</p>
            </li>
          )}
        </ol>
      </div>
    </section>
  );
}
