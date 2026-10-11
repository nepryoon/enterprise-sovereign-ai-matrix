"use client";
import { useEffect, useRef, type RefObject } from "react";

export const STREAM_IDLE_MS = 5_000;
export const RECONCILE_INTERVAL_MS = 3_000;

/**
 * Fallback for a stream that delivers nothing (a buffering proxy, a dropped connection): while
 * `active` (the execution is non-terminal) and no byte has arrived for STREAM_IDLE_MS, call
 * `reconcile` (GET /executions/{id}) every RECONCILE_INTERVAL_MS until the stream speaks again.
 */
export function useStaleStreamReconcile(active: boolean, lastActivity: RefObject<number>, reconcile: () => Promise<void> | void) {
  const callback = useRef(reconcile);
  useEffect(() => { callback.current = reconcile; }, [reconcile]);
  useEffect(() => {
    if (!active) return;
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const idle = Date.now() - lastActivity.current;
      if (idle >= STREAM_IDLE_MS) {
        void callback.current();
        timer = setTimeout(tick, RECONCILE_INTERVAL_MS);
      } else {
        timer = setTimeout(tick, STREAM_IDLE_MS - idle);
      }
    };
    timer = setTimeout(tick, Math.max(0, STREAM_IDLE_MS - (Date.now() - lastActivity.current)));
    return () => clearTimeout(timer);
  }, [active, lastActivity]);
}
