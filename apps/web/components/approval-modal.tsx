"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import type { Execution } from "@/types";

export function ApprovalModal({
  execution,
  busy,
  onDecision,
  onDismiss,
}: {
  execution: Execution;
  busy: boolean;
  onDecision: (choice: "approve" | "reject", reason: string) => Promise<void>;
  onDismiss?: () => void;
}) {
  const [reason, setReason] = useState("");
  const dialog = useRef<HTMLElement>(null);

  useEffect(() => {
    const prior = document.activeElement as HTMLElement | null;
    const root = dialog.current;
    root?.querySelector<HTMLElement>("textarea")?.focus();

    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onDismiss?.();
        return;
      }
      if (event.key !== "Tab" || !root) return;
      const items = [
        ...root.querySelectorAll<HTMLElement>(
          'button:not([disabled]),textarea:not([disabled])',
        ),
      ];
      if (!items.length) return;
      const first = items[0];
      const last = items.at(-1)!;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      prior?.focus();
    };
  }, [onDismiss]);

  return (
    <div className="modal-backdrop">
      <section
        ref={dialog}
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="approval-title"
        aria-describedby="approval-description"
      >
        <Button
          variant="outline"
          className="modal-close"
          aria-label="Close approval dialog"
          onClick={onDismiss}
        >
          ×
        </Button>
        <div className="eyebrow">Governance intercept · {execution.risk_level} risk</div>
        <h2 id="approval-title">Human decision required</h2>
        <p id="approval-description" className="muted-copy">
          Execution <code>{execution.execution_id.slice(0, 8)}</code> is paused by the backend.
          Record an accountable operator decision.
        </p>
        <div className="evidence">
          <strong>Policy evidence</strong>
          {execution.evidence?.length ? (
            <ul>{execution.evidence.map((item) => <li key={item}>{item}</li>)}</ul>
          ) : (
            <p>Awaiting authoritative execution evidence.</p>
          )}
          <strong>Recommendation</strong>
          <p>
            {execution.recommended_decision ??
              "Inspect the server-authoritative record before deciding."}
          </p>
        </div>
        <label htmlFor="operator-rationale">
          Operator rationale <span>(optional)</span>
        </label>
        <textarea
          id="operator-rationale"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Record evidence supporting your decision…"
        />
        <div className="modal-actions">
          <Button
            variant="destructive"
            className="reject"
            disabled={busy}
            onClick={() => void onDecision("reject", reason)}
          >
            Reject change
          </Button>
          <Button disabled={busy} onClick={() => void onDecision("approve", reason)}>
            {busy ? "Recording…" : "Approve & resume"}
          </Button>
        </div>
      </section>
    </div>
  );
}
